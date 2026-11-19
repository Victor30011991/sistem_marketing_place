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
  getDoc,
  deleteDoc,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { Pedido, Product, Registro, StoreInfo, Venda } from '../types';
import { pedidoDe } from '../core/clientes';
import { COLECOES, DEL, INC, LOJA_ID, emLotes, type Colecao, type ItemColecao, type Op, type Raiz } from './modelo';

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
  | { parte: Colecao; valor: Map<string, ItemColecao> };

/** Ouve as partes da loja em tempo real. `servidor` diz se a resposta veio da internet (e não só da cópia do aparelho). */
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
    ...COLECOES.map((c) => onSnapshot(collection(raiz, c), opt, (s) => cb({ parte: c, valor: mapa(s.docs, (d, id) => ({ ...d, id })) }, !s.metadata.fromCache), erro)),
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

/** Pedidos feitos no cardápio desde a data (ISO), ao vivo. */
export function ouvirPedidos(desde: string, cb: (lista: Pedido[]) => void, erro: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(db, 'pedidos'), where('criado', '>=', desde)),
    (s) => cb(s.docs.flatMap((d) => {
      const p = pedidoDe(d.id, d.data());
      return p ? [p] : [];
    })),
    erro,
  );
}

export const mudarPedido = (id: string, patch: Partial<Pick<Pedido, 'situacao' | 'vendaPausada'>>) => updateDoc(doc(db, 'pedidos', id), patch);

/** Grava o histórico de alterações (quem mudou o quê). */
export async function registrar(regs: Registro[]): Promise<void> {
  const b = writeBatch(db);
  for (const r of regs.slice(0, 450)) b.set(doc(db, 'lojas', LOJA_ID, 'historico', r.id), r);
  await b.commit();
}

/** Últimas alterações, da mais nova para a mais antiga. */
export async function lerHistorico(max = 300): Promise<Registro[]> {
  const s = await getDocs(query(collection(db, 'lojas', LOJA_ID, 'historico'), orderBy('quando', 'desc'), limit(max)));
  return s.docs.map((d) => d.data() as Registro);
}

export interface CopiaInfo {
  id: string;
  quando: string;
  produtos: number;
  tamanho: number;
}

/** Cópia automática do backup (compactada), guardada na própria nuvem. */
export async function salvarCopia(c: CopiaInfo & { gz: string }): Promise<void> {
  await setDoc(doc(db, 'lojas', LOJA_ID, 'copias', c.id), c);
}
export async function listarCopias(): Promise<CopiaInfo[]> {
  const s = await getDocs(query(collection(db, 'lojas', LOJA_ID, 'copias'), orderBy('quando', 'desc')));
  return s.docs.map((d) => {
    const { gz: _g, ...info } = d.data() as CopiaInfo & { gz: string };
    return info;
  });
}
export async function lerCopia(id: string): Promise<string | null> {
  const s = await getDoc(doc(db, 'lojas', LOJA_ID, 'copias', id));
  return s.exists() ? ((s.data() as { gz: string }).gz ?? null) : null;
}
export const apagarCopia = (id: string) => deleteDoc(doc(db, 'lojas', LOJA_ID, 'copias', id));

/** Publica o cardápio que o cliente vê (só nome, categoria e preço; nunca custos). */
export function publicarCardapio(json: string): Promise<void> {
  return setDoc(doc(db, 'publico', 'cardapio'), { json, atualizado: new Date().toISOString() });
}
