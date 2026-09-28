import { SEATS, type Card, type GameResult, type GameState, type Move, type Seat, type SeatView } from '@gaple/aturan';
import { DURASI, durasiEvent, type EventKlien, type Pesan } from '@gaple/ruang';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Suara } from '../audio/suara';
import { dealClicks, wait } from '../jadwal';
import type { TampilanGame } from '../LayarMeja';
import type { Presentation, PresentationEvent, SessionSummary } from '../presentasi';
import type { SambunganRuang } from './sambungan';

type Transisi = { readonly events: readonly EventKlien[]; readonly pandangan: SeatView };

/** Kartu lawan tidak dikenal klien: diganti punggung kartu sejumlah sisa kartunya. */
const punggung = (seat: Seat, n: number): Card[] => Array.from({ length: n }, (_, i) => ({ id: `?${seat}-${i}`, a: -1, b: -1 }));

/** `GameState` tampilan dari pandangan kursi, agar meja yang sama dipakai offline dan online. */
function stateTampilan(v: SeatView, bagi?: { hand: readonly Card[] | null; handCounts: readonly number[] }): GameState {
  const hands = SEATS.map((s) => s === v.seat ? bagi?.hand ?? v.hand : punggung(s, bagi?.handCounts[s] ?? v.handCounts[s]!));
  const chain = bagi ? { placements: [], ends: null } : v.chain;
  return {
    config: v.config,
    totals: v.totals,
    session: { number: v.sessionNumber, hands, chain, opening: v.opening, turn: v.turn, result: bagi ? null : v.sessionResult },
    result: bagi ? null : v.gameResult,
  };
}

function ringkasan(events: readonly EventKlien[]): SessionSummary | null {
  if (events.some((e) => e.type === 'gameEnded')) return null;
  const akhir = events.find((e) => e.type === 'sessionEnded');
  return akhir?.type === 'sessionEnded'
    ? { cause: akhir.cause, hands: akhir.hands, sessionPoints: akhir.sessionPoints, totals: akhir.totals }
    : null;
}

function hasilGame(events: readonly EventKlien[]): GameResult | null {
  const akhir = events.find((e) => e.type === 'gameEnded');
  return akhir?.type === 'gameEnded' ? akhir.result : null;
}

/**
 * Pengendali game online: menerima snapshot dan event tersensor, mengantrekan presentasi dengan
 * durasi bersama, dan membuka input hanya pada giliran sendiri setelah jendela presentasi server selesai.
 * Server tidak pernah menunggu klien: klien yang tertinggal melompat ke keadaan terbaru.
 */
export function useOnlineGame(sambungan: SambunganRuang, audio: Suara, kanvasSiap: boolean): TampilanGame & { seat: Seat } {
  const [seat, setSeat] = useState<Seat>(0);
  const [state, setState] = useState<GameState | null>(null);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [redealNotice, setRedealNotice] = useState(false);
  const [jendelaTerbuka, setJendelaTerbuka] = useState(true);
  const [menunggu, setMenunggu] = useState(false);
  const antrean = useRef<Transisi[]>([]);
  const berjalan = useRef(false);
  /** Naik setiap snapshot: transisi dari generasi lama tidak boleh menimpa snapshot. */
  const generasi = useRef(0);
  const aborter = useRef<AbortController | null>(null);
  const siap = useRef(kanvasSiap);
  const serial = useRef(0);
  const timerJendela = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerBagiUlang = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const present = (event: PresentationEvent) => {
    setPresentation({ ...event, key: ++serial.current, at: performance.now() } as Presentation);
  };

  /** Input baru dibuka setelah sisa jendela presentasi server lewat (diukur dari waktu terima). */
  const bukaSetelah = (sisa: number) => {
    clearTimeout(timerJendela.current);
    setJendelaTerbuka(sisa <= 0);
    if (sisa > 0) timerJendela.current = setTimeout(() => setJendelaTerbuka(true), sisa);
  };

  const tampilkanAkhir = (t: Transisi) => {
    setState(stateTampilan(t.pandangan));
    setPresentation(null);
    setSummary(ringkasan(t.events));
    setGameResult(hasilGame(t.events) ?? t.pandangan.gameResult);
  };

  const presentasikan = async (t: Transisi, signal: AbortSignal) => {
    setSummary(null);
    const bagi = t.events.filter((e) => e.type === 'dealt');
    if (bagi.length > 0) {
      for (const e of bagi) {
        setState(stateTampilan(t.pandangan, e));
        present({ kind: 'deal' });
        if (e.redeal) {
          clearTimeout(timerBagiUlang.current);
          setRedealNotice(true);
          timerBagiUlang.current = setTimeout(() => setRedealNotice(false), DURASI.notifikasiBagiUlang);
        }
        const cancelClicks = dealClicks(audio, signal);
        const alive = await wait(durasiEvent(e), signal);
        cancelClicks();
        if (!alive) return;
      }
      tampilkanAkhir(t);
      return;
    }
    setState(stateTampilan(t.pandangan));
    for (const e of t.events) {
      if (e.type === 'cardPlaced') {
        present({ kind: 'move', cardId: e.card.id, seat: e.seat });
        if (!await wait(DURASI.kartuTerbang, signal)) return;
        audio.cardLand();
        if (e.balak) {
          present({ kind: 'balak', pip: e.card.a });
          audio.balak();
          if (!await wait(DURASI.balak, signal)) return;
        }
      } else if (e.type === 'pass') {
        present({ kind: 'pass', seat: e.seat });
        audio.pass();
        if (!await wait(durasiEvent(e), signal)) return;
      } else if (e.type === 'sessionEnded') {
        present(e.cause.kind === 'emptyHand' ? { kind: 'win', seat: e.cause.winner } : { kind: 'gaplek', pip: e.cause.pip });
        if (e.cause.kind === 'emptyHand') audio.winSession(); else audio.gaplek();
        if (!await wait(durasiEvent(e), signal)) return;
      } else if (e.type === 'gameEnded' && e.result.champions.length) {
        present({ kind: 'champion', seats: e.result.champions });
        audio.champion();
        if (!await wait(durasiEvent(e), signal)) return;
      }
    }
    // Ringkasan ronde tetap tampil sampai pembagian ronde berikutnya tiba dari server.
    tampilkanAkhir(t);
  };

  const jalankan = useCallback(async () => {
    if (berjalan.current || !siap.current) return;
    berjalan.current = true;
    setBusy(true);
    while (antrean.current.length > 0) {
      const t = antrean.current.shift()!;
      // Tertinggal: masih ada transisi lain menunggu atau tab tidak terlihat → langsung ke keadaan terbaru.
      if (antrean.current.length > 0 || document.hidden) {
        tampilkanAkhir(t);
        continue;
      }
      const ctrl = new AbortController();
      const gen = generasi.current;
      aborter.current = ctrl;
      await presentasikan(t, ctrl.signal);
      if (ctrl.signal.aborted && gen === generasi.current) tampilkanAkhir(t);
    }
    aborter.current = null;
    berjalan.current = false;
    setBusy(false);
  }, [audio]);

  useEffect(() => {
    siap.current = kanvasSiap;
    if (kanvasSiap) void jalankan();
  }, [kanvasSiap, jalankan]);

  useEffect(() => sambungan.dengarPesan((pesan: Pesan) => {
    if (pesan.jenis === 'ditolak') {
      setMenunggu(false);
      return;
    }
    if (pesan.jenis === 'snapshot') {
      if (pesan.kursi !== null) setSeat(pesan.kursi);
      antrean.current = [];
      generasi.current++;
      aborter.current?.abort();
      if (pesan.pandangan) tampilkanAkhir({ events: [], pandangan: pesan.pandangan });
      bukaSetelah(pesan.sisaPresentasi);
      return;
    }
    setMenunggu(false);
    bukaSetelah(pesan.sisaPresentasi);
    antrean.current.push({ events: pesan.events, pandangan: pesan.pandangan });
    // Transisi baru saat presentasi masih berjalan berarti klien tertinggal: potong yang sedang tampil.
    aborter.current?.abort();
    void jalankan();
  }), [sambungan, jalankan]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) aborter.current?.abort(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      aborter.current?.abort();
      clearTimeout(timerJendela.current);
      clearTimeout(timerBagiUlang.current);
    };
  }, []);

  const canAct = !!state && !busy && !menunggu && jendelaTerbuka && !state.session.result && state.session.turn === seat;

  const play = useCallback((move: Move) => {
    if (!canAct || move.seat !== seat) return;
    setMenunggu(true);
    sambungan.pasang(move);
  }, [canAct, seat, sambungan]);

  return { seat, state, presentation, play, canAct, summary, gameResult, redealNotice };
}
