// Cloud Function do protótipo (Firebase, Node 22). Mesmas ações da Edge Function do Supabase:
//   saveSync({ action: 'list' | 'open' | 'save', slot, save, baseVersion })
// Chamada pelo SDK do cliente (httpsCallable): o login (anônimo) vem junto automaticamente.
// A lógica do jogo vem de ./lib/mistpeak-server.mjs (gerado por `npm run build:backend`).
// Atenção: deploy de Cloud Functions exige o plano Blaze (com cartão), mesmo dentro da cota grátis.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { acceptUpload, openCharacter } from './lib/mistpeak-server.mjs';

initializeApp();
const db = getFirestore();

export const saveSync = onCall({ region: 'southamerica-east1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sem login');
  const now = Date.now(); // relógio do servidor
  const { action, slot, save, baseVersion } = req.data ?? {};
  const chars = db.collection('users').doc(uid).collection('characters');

  if (action === 'list') {
    const snap = await chars.get();
    return {
      now,
      slots: snap.docs.map((d) => {
        const c = d.data();
        return {
          slot: c.slot,
          version: c.version,
          serverSavedAt: c.serverSavedAt,
          lastPlayed: c.lastPlayed,
          name: c.save?.name,
          level: c.save?.level,
          classId: c.save?.classId,
        };
      }),
    };
  }
  if (!(Number(slot) >= 0 && Number(slot) <= 3)) throw new HttpsError('invalid-argument', 'espaço inválido');
  const ref = chars.doc(String(slot));

  const write = async (tx, row) => {
    const all = await tx.get(chars.where('lastPlayed', '==', true));
    for (const d of all.docs) if (d.id !== ref.id) tx.update(d.ref, { lastPlayed: false });
    tx.set(ref, { ...row, lastPlayed: true });
    tx.set(ref.collection('history').doc(String(row.version)), {
      save: row.save,
      checksum: row.checksum,
      serverSavedAt: row.serverSavedAt,
    });
    // histórico: guardar só as 5 últimas versões (apagar as antigas fica para uma rotina no M1)
  };

  if (action === 'open') {
    return db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists) throw new HttpsError('not-found', 'vazio');
      const c = cur.data();
      const { row, offline } = await openCharacter(c, now, !!c.lastPlayed);
      if (offline) await write(tx, row);
      return { now, character: row, offline };
    });
  }
  if (action === 'save') {
    return db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      const c = cur.exists ? cur.data() : null;
      if (c && Number(baseVersion) !== c.version) throw new HttpsError('aborted', 'conflito', { server: c });
      const row = await acceptUpload(c, Number(slot), save, now);
      await write(tx, row);
      return { now, version: row.version, checksum: row.checksum, flags: row.flags };
    });
  }
  throw new HttpsError('invalid-argument', 'ação desconhecida');
});
