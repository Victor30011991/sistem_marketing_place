/**
 * Ligação com o Firebase (login Google + banco Firestore).
 * Este arquivo só é baixado quando alguém entra na nuvem: quem não usa não paga o peso dele.
 * A configuração abaixo é pública por natureza (vai para o navegador); quem protege os dados são as regras do Firestore.
 */
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import {
  FieldPath,
  collection,
  deleteField,
  doc,
  increment,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { Lote, Product, StoreInfo, Venda } from '../types';
import { DEL, INC, LOJA_ID, emLotes, type Op, type Raiz } from './modelo';

const app = initializeApp({
  apiKey: 'AIzaSyBIe_OH9xytji9DKWT_5-Pd-p8PyNk0lUE',
  authDomain: 'temperei.firebaseapp.com',
  projectId: 'temperei',
  storageBucket: 'temperei.firebasestorage.app',
  messagingSenderId: '406379203381',
  appId: '1:406379203381:web:fe2060f91b332dc4df9a7c',
});

const auth = getAuth(app);
const db = initializeFirestore(app, {
  // guarda uma cópia no aparelho: funciona sem internet e envia quando a conexão volta
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

export function aoMudarUsuario(cb: (u: { email: string; verificado: boolean } | null) => void): () => void {
  return onAuthStateChanged(auth, (u: User | null) => cb(u ? { email: (u.email ?? '').toLowerCase(), verificado: u.emailVerified } : null));
}

export async function entrar(): Promise<void> {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, prov);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, prov);
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export const sair = () => signOut(auth);

export type Parte =
  | { parte: 'raiz'; valor: Raiz | null }
  | { parte: 'loja'; valor: StoreInfo | null }
  | { parte: 'produtos'; valor: Map<string, Product> }
  | { parte: 'dias'; valor: Map<string, Record<string, Venda>> }
  | { parte: 'lotes'; valor: Map<string, Lote> };

/** Ouve as cinco partes da loja em tempo real. `servidor` diz se a resposta veio da internet (e não só da cópia do aparelho). */
export function ouvir(inicioVendas: string, cb: (p: Parte, servidor: boolean) => void, erro: (e: Error) => void): () => void {
  const raiz = doc(db, 'lojas', LOJA_ID);
  const opt = { includeMetadataChanges: true };
  const mapa = <T>(docs: { id: string; data(): DocumentData }[], f: (d: DocumentData, id: string) => T) => new Map(docs.map((d) => [d.id, f(d.data(), d.id)]));
  const subs = [
    onSnapshot(raiz, opt, (s) => cb({ parte: 'raiz', valor: s.exists() ? (s.data() as Raiz) : null }, !s.metadata.fromCache), erro),
    onSnapshot(doc(raiz, 'meta', 'loja'), opt, (s) => cb({ parte: 'loja', valor: s.exists() ? (s.data() as StoreInfo) : null }, !s.metadata.fromCache), erro),
    onSnapshot(collection(raiz, 'produtos'), opt, (s) => cb({ parte: 'produtos', valor: mapa(s.docs, (d, id) => ({ ...(d as Product), id })) }, !s.metadata.fromCache), erro),
    onSnapshot(
      query(collection(raiz, 'vendasDia'), where('dia', '>=', inicioVendas)),
      opt,
      (s) => cb({ parte: 'dias', valor: new Map(s.docs.filter((d) => d.data().v && Object.keys(d.data().v).length).map((d) => [d.id, d.data().v as Record<string, Venda>])) }, !s.metadata.fromCache),
      erro,
    ),
    onSnapshot(collection(raiz, 'lotes'), opt, (s) => cb({ parte: 'lotes', valor: mapa(s.docs, (d, id) => ({ ...(d as Lote), id })) }, !s.metadata.fromCache), erro),
  ];
  return () => subs.forEach((u) => u());
}

/** Troca os marcadores do modelo pelos do Firestore (incremento e apagar campo). */
function converter(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(converter);
  if (v && typeof v === 'object') {
    if (INC in v) return increment((v as Record<string, number>)[INC]);
    if (DEL in v) return deleteField();
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = converter(x);
    return o;
  }
  return v;
}

/** Grava as alterações. Sem internet, ficam guardadas no aparelho e seguem quando a conexão voltar. */
export async function gravar(ops: Op[]): Promise<void> {
  const envios: Promise<void>[] = [];
  for (const grupo of emLotes(ops)) {
    const b = writeBatch(db);
    for (const op of grupo) {
      const ref = doc(db, op.caminho.join('/'));
      if (op.apagar) b.delete(ref);
      else if (op.campos) b.set(ref, converter(op.dados) as DocumentData, { mergeFields: op.campos.map((c) => new FieldPath(...c)) });
      else b.set(ref, converter(op.dados) as DocumentData);
    }
    // todos os grupos entram na fila do aparelho já; a promessa só termina quando a internet confirmar
    envios.push(b.commit());
  }
  await Promise.all(envios);
}

/** Publica o cardápio que o cliente vê (só nome, categoria e preço; nunca custos). */
export function publicarCardapio(json: string): Promise<void> {
  return setDoc(doc(db, 'publico', 'cardapio'), { json, atualizado: new Date().toISOString() });
}
