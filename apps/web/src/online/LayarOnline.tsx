import { SEATS, type Seat } from '@gaple/aturan';
import { TARGET_POIN_MAKS, normalisasiKode, rapikanNama, type AlasanTolak } from '@gaple/ruang';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Suara } from '../audio/suara';
import type { GambarMeja } from '../gambarMeja';
import { button } from '../gaya';
import { LayarMeja } from '../LayarMeja';
import type { SeatInfo } from '../meja/Meja';
import {
  PESAN_KODE_TIDAK_ADA, PESAN_NAMA_TIDAK_SAH, alasanGagal, namaTerakhir, pesanGagal, pesanTolak, sambungRuang, sambungRuangBaru, tautanRuang,
  type LobiKlien, type SambunganRuang, type StatusSambungan,
} from './sambungan';
import { perbaruiAplikasi } from './pembaruan';
import { useOnlineGame } from './useOnlineGame';

const halaman: React.CSSProperties = {
  height: '100%', overflowY: 'auto', display: 'grid', placeItems: 'center', padding: 16, boxSizing: 'border-box',
  color: '#fff', fontFamily: 'system-ui',
};

const kartuPanel: React.CSSProperties = {
  width: 'min(100%, 400px)', display: 'grid', gap: 14, padding: '20px 18px', boxSizing: 'border-box',
  borderRadius: 16, background: 'rgba(0,0,0,.35)',
};

const tombolKedua: React.CSSProperties = { ...button, background: 'rgba(255,255,255,.14)', color: '#fff' };
const tombolKecil: React.CSSProperties = { ...tombolKedua, font: '600 13px system-ui', padding: '6px 12px' };
const masukan: React.CSSProperties = { font: '16px system-ui', padding: '10px 12px', borderRadius: 10, border: '1px solid #fff5', minWidth: 0 };
const galatGaya: React.CSSProperties = { margin: 0, color: '#ffb3a9' };
/** Pil status kecil yang melayang di tengah layar (menyambung ulang, bot memainkan kursi). */
const pilMelayang: React.CSSProperties = {
  position: 'fixed', left: '50%', transform: 'translateX(-50%)', borderRadius: 999,
  background: 'rgba(0,0,0,.72)', color: '#fff', font: '600 14px system-ui', whiteSpace: 'nowrap',
};
const overlayPenuh: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', padding: 16,
  background: 'rgba(0,0,0,.6)', color: '#fff', fontFamily: 'system-ui',
};

type Props = {
  audio: Suara; muted: boolean; onMute: () => void; gambar: GambarMeja;
  /** Kode dari tautan `/r/<kode>`, jika aplikasi dibuka lewat tautan ruang. */
  kodeAwal: string | null;
  onKeluar: () => void;
};

export function LayarOnline(props: Props) {
  const [sambungan, setSambungan] = useState<SambunganRuang | null>(null);
  useEffect(() => {
    if (sambungan) history.replaceState(null, '', `${import.meta.env.BASE_URL}r/${sambungan.kode}`);
  }, [sambungan]);
  const online = useSyncExternalStore(dengarOnline, () => navigator.onLine);
  if (!sambungan && !online) return <ButuhInternet onKembali={props.onKeluar} />;
  if (!sambungan) return <FormMasuk kodeAwal={props.kodeAwal} onMasuk={setSambungan} onKembali={props.onKeluar} />;
  return <RuangOnline {...props} sambungan={sambungan} />;
}

function dengarOnline(fn: () => void): () => void {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

/** Mode online tanpa koneksi: beri tahu, dan mode offline tetap bisa dipakai dari menu. */
function ButuhInternet({ onKembali }: { onKembali: () => void }) {
  return (
    <div style={halaman}>
      <div style={kartuPanel} data-testid="butuh-internet">
        <h1 style={{ fontSize: 28, margin: 0 }}>Main online</h1>
        <p role="alert" style={{ margin: 0, fontSize: 16 }}>
          Main online butuh koneksi internet. Sambungkan internet, atau kembali ke menu untuk main offline melawan bot.
        </p>
        <button type="button" style={button} onClick={onKembali}>Kembali ke menu</button>
      </div>
    </div>
  );
}

function FormMasuk({ kodeAwal, onMasuk, onKembali }: { kodeAwal: string | null; onMasuk: (s: SambunganRuang) => void; onKembali: () => void }) {
  const [nama, setNama] = useState(namaTerakhir);
  const [kode, setKode] = useState(kodeAwal ?? '');
  const [galat, setGalat] = useState<string | null>(null);
  // Lewat tautan: coba masuk dulu tanpa nama, supaya token yang dikenal ruang langsung kembali ke tempatnya.
  const [memuat, setMemuat] = useState<string | null>(kodeAwal ? 'Menyambung ke ruang…' : null);
  const lewatTautan = kodeAwal !== null;

  const coba = async (label: string, sambung: () => Promise<SambunganRuang>, kodeRuang: string | null, galatNamaKosong = true) => {
    setMemuat(label);
    setGalat(null);
    try {
      onMasuk(await sambung());
    } catch (err) {
      const alasan = alasanGagal(err);
      // Versi lama: perbarui aplikasi lalu muat ulang di tautan ruang (membuat ruang cukup muat ulang di menu).
      if (alasan === 'perlu-pembaruan') {
        setMemuat('Memperbarui aplikasi…');
        if (await perbaruiAplikasi(kodeRuang)) return;
      }
      if (galatNamaKosong || alasan !== 'nama-tidak-sah') setGalat(pesanGagal(err));
      setMemuat(null);
    }
  };

  const dicoba = useRef(false);
  useEffect(() => {
    if (!kodeAwal || dicoba.current) return;
    dicoba.current = true;
    const k = normalisasiKode(kodeAwal);
    if (!k) {
      setGalat(PESAN_KODE_TIDAK_ADA);
      setMemuat(null);
      return;
    }
    void coba('Menyambung ke ruang…', () => sambungRuang(k, ''), k, false);
  }, [kodeAwal]);

  const namaSah = () => {
    if (rapikanNama(nama) !== null) return true;
    setGalat(PESAN_NAMA_TIDAK_SAH);
    return false;
  };

  const buat = () => { if (namaSah()) void coba('Membuat ruang…', () => sambungRuangBaru(nama), null); };
  const gabung = () => {
    const k = normalisasiKode(kode);
    if (!k) return setGalat('Kode undangan terdiri dari 6 huruf dan angka.');
    if (namaSah()) void coba('Bergabung…', () => sambungRuang(k, nama), k);
  };

  // Enter di kolom nama membuat ruang kecuali kode sudah diisi; tombol Gabung selalu bergabung.
  const kirim = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tombol = (e.nativeEvent as SubmitEvent).submitter;
    if (lewatTautan || kode.trim() || tombol?.getAttribute('name') === 'gabung') gabung();
    else buat();
  };

  return (
    <div style={halaman}>
      <form style={kartuPanel} onSubmit={kirim}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Main online</h1>
        <label style={{ display: 'grid', gap: 6, fontSize: 15 }}>
          Nama panggilan
          <input value={nama} onChange={(e) => setNama(e.target.value)} autoFocus maxLength={40} style={masukan} />
        </label>
        {lewatTautan ? (
          <>
            <p style={{ margin: 0, fontSize: 15 }}>Bergabung ke ruang <strong style={{ letterSpacing: 2 }}>{normalisasiKode(kodeAwal) ?? kodeAwal}</strong></p>
            <button type="submit" style={button} disabled={!!memuat}>Gabung</button>
          </>
        ) : (
          <>
            <button type="button" style={button} disabled={!!memuat} onClick={buat}>Buat ruang</button>
            <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.7 }}>atau gabung ke ruang teman</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                aria-label="Kode undangan"
                placeholder="Kode undangan"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                style={{ ...masukan, flex: 1, textTransform: 'uppercase', letterSpacing: 2 }}
              />
              <button type="submit" name="gabung" style={{ ...tombolKedua, padding: '10px 18px' }} disabled={!!memuat}>Gabung</button>
            </div>
          </>
        )}
        {memuat && <p style={{ margin: 0, opacity: 0.8 }}>{memuat}</p>}
        {galat && <p role="alert" style={galatGaya}>{galat}</p>}
        <button type="button" style={tombolKedua} onClick={onKembali}>Kembali</button>
      </form>
    </div>
  );
}

function RuangOnline({ sambungan, audio, muted, onMute, gambar, onKeluar }: Props & { sambungan: SambunganRuang }) {
  const lobi = useSyncExternalStore(sambungan.dengarLobi, sambungan.lobiSekarang);
  const status = useSyncExternalStore(sambungan.dengarStatus, sambungan.statusSekarang);
  const [kanvasSiap, setKanvasSiap] = useState(false);
  const [kursiSaya, setKursiSaya] = useState<Seat | null>(null);
  const diambilAlih = lobi?.fase === 'bermain' && kursiSaya !== null && !!lobi.kursi[kursiSaya]?.diambilAlih;
  const game = useOnlineGame(sambungan, audio, kanvasSiap, status !== 'tersambung' || diambilAlih);
  useEffect(() => setKursiSaya(game.kursi), [game.kursi]);
  /** Setelah hasil akhir, pemain memilih kembali ke lobi sambil menunggu host memulai game baru. */
  const [keLobi, setKeLobi] = useState(false);
  // Menutup layar (misalnya ke menu) hanya menutup koneksi; kursi dilepas lewat tombol keluar.
  useEffect(() => () => { sambungan.tutup(); audio.cancelPending(); }, [sambungan, audio]);
  const keluarRuang = () => {
    sambungan.keluar();
    onKeluar();
  };

  const fase = lobi?.fase;
  useEffect(() => { if (fase === 'bermain') setKeLobi(false); }, [fase]);
  const tampilMeja = fase === 'bermain' || (fase === 'hasil' && !keLobi && !!game.state);
  // Kanvas baru dibuat setiap kali meja tampil lagi; tunggu siap sebelum presentasi (ADR 0001).
  useEffect(() => { if (!tampilMeja) setKanvasSiap(false); }, [tampilMeja]);

  const penanda = <PenandaSambungan status={status} sambungan={sambungan} onKeluar={onKeluar} />;
  // Orang di ruang tanpa kursi menonton meja tanpa melihat tangan siapa pun.
  const penonton = game.kursi === null;
  if (!lobi || !tampilMeja) {
    return <>{penanda}<Lobi sambungan={sambungan} lobi={lobi} kursiSaya={game.kursi} onKeluar={keluarRuang} /></>;
  }

  const seats: SeatInfo[] = lobi.kursi.map((k) => ({
    name: k.nama,
    bot: k.jenis === 'bot' || k.diambilAlih,
    terputus: k.terputus,
  }));
  return (
    <>
    {penanda}
    {penonton && (
      <div role="status" data-testid="label-penonton" style={{ ...pilMelayang, top: 64, zIndex: 3, padding: '6px 14px', pointerEvents: 'none' }}>
        Kamu menonton
      </div>
    )}
    {diambilAlih && status === 'tersambung' && (
      <div role="status" data-testid="diambil-alih" style={{ ...pilMelayang, bottom: 16, zIndex: 3, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px' }}>
        Bot memainkan kursimu
        <button style={{ ...button, padding: '6px 14px', fontSize: 14 }} onClick={() => sambungan.ambilKendali()}>Ambil kendali</button>
      </div>
    )}
    <LayarMeja
      game={game}
      seats={seats}
      humanSeat={game.seat}
      penonton={penonton}
      muted={muted}
      onMute={onMute}
      gambar={gambar}
      onReady={() => setKanvasSiap(true)}
      exitConfirm={penonton ? 'Berhenti menonton dan keluar dari ruang?' : 'Keluar dari ruang? Game tetap berjalan tanpa kamu.'}
      onExit={keluarRuang}
      onPlayAgain={() => setKeLobi(true)}
      onBackToMenu={keluarRuang}
    />
    </>
  );
}

/** Indikator "menyambung ulang…", atau layar penghalang saat ruang dibuka di tab lain atau sudah hilang. */
function PenandaSambungan({ status, sambungan, onKeluar }: { status: StatusSambungan; sambungan: SambunganRuang; onKeluar: () => void }) {
  if (status === 'tersambung') return null;
  if (status === 'menyambung') {
    return (
      <div role="status" data-testid="menyambung-ulang" style={{ ...pilMelayang, top: 12, zIndex: 4, padding: '8px 16px' }}>
        Menyambung ulang…
      </div>
    );
  }
  return (
    <div style={overlayPenuh}>
      <div role="alertdialog" aria-label="Koneksi ruang" style={kartuPanel} data-testid={status === 'digantikan' ? 'digantikan' : 'ruang-hilang'}>
        <p style={{ margin: 0, fontSize: 16 }}>
          {status === 'digantikan'
            ? 'Ruang ini dibuka di tab atau jendela lain. Tab ini tidak lagi tersambung.'
            : 'Ruang sudah tidak tersedia. Minta tautan atau kode baru ke host.'}
        </p>
        {status === 'digantikan' && <button style={button} onClick={() => sambungan.sambungUlang()}>Pakai di tab ini</button>}
        <button style={tombolKedua} onClick={onKeluar}>Ke menu</button>
      </div>
    </div>
  );
}

function Lobi({ sambungan, lobi, kursiSaya, onKeluar }: {
  sambungan: SambunganRuang; lobi: LobiKlien | null; kursiSaya: Seat | null; onKeluar: () => void;
}) {
  const host = kursiSaya !== null && lobi?.hostKursi === kursiSaya;
  const [tolakan, setTolakan] = useState<string | null>(null);
  useEffect(() => sambungan.dengarTolak((alasan: AlasanTolak) => setTolakan(pesanTolak(alasan))), [sambungan]);
  // Di luar game kursi bot dianggap kosong.
  const kosong = (i: number) => lobi?.kursi[i]?.jenis !== 'manusia';

  return (
    <div style={halaman}>
      <div style={kartuPanel} data-testid="lobi">
        <h1 style={{ fontSize: 24, margin: 0 }}>Ruang privat</h1>
        <KodeUndangan kode={sambungan.kode} />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-label="Kursi">
          {(lobi?.kursi ?? []).map((k, i) => {
            const seat = i as Seat;
            const saya = seat === kursiSaya;
            return (
              <li key={i} data-testid="kursi-lobi" style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
                background: saya ? 'rgba(255,213,74,.2)' : k.jenis === 'manusia' ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)',
                border: saya ? '1px solid #ffd54a88' : '1px solid transparent',
              }}>
                <span style={{ fontSize: 12, opacity: 0.6, width: 46 }}>Kursi {i + 1}</span>
                <span style={{ flex: 1, minWidth: 80 }}>
                  {k.jenis === 'manusia' ? <strong>{k.nama}</strong> : <em style={{ opacity: 0.6 }}>{k.jenis === 'bot' ? `${k.nama} (bot)` : 'Kosong'}</em>}
                  {saya && ' (kamu)'}
                  {k.terputus && <span data-testid="terputus" style={{ color: '#ffb3a9', fontSize: 12, fontWeight: 700, marginLeft: 6 }}>Terputus</span>}
                  {lobi?.hostKursi === i && <span style={{ color: '#ffe08a', fontSize: 12, fontWeight: 700, marginLeft: 6 }}>Host</span>}
                </span>
                {kosong(i) && !saya && (
                  <button style={tombolKecil} onClick={() => sambungan.pilihKursi(seat)}>Duduk di sini</button>
                )}
                {host && !saya && k.jenis === 'manusia' && (
                  <>
                    <select
                      aria-label={`Pindahkan ${k.nama}`}
                      value=""
                      onChange={(e) => sambungan.pindahkan(seat, Number(e.target.value) as Seat)}
                      style={{ font: '13px system-ui', padding: '5px 6px', borderRadius: 8 }}
                    >
                      <option value="" disabled>Pindahkan…</option>
                      {SEATS.filter((s) => s !== seat).map((s) => (
                        <option key={s} value={s}>ke kursi {s + 1}{kosong(s) ? '' : ' (tukar)'}</option>
                      ))}
                    </select>
                    <button style={tombolKecil} onClick={() => sambungan.kosongkan(seat)}>Kosongkan</button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {!!lobi?.penonton.length && (
          <p data-testid="penonton" style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>
            Penonton: {lobi.penonton.join(', ')}
          </p>
        )}
        {kursiSaya === null && <p style={{ margin: 0, color: '#ffe08a' }}>Kamu menonton. Pilih kursi kosong untuk ikut bermain.</p>}
        {lobi && <Konfigurasi sambungan={sambungan} lobi={lobi} host={host} />}
        {tolakan && <p role="alert" style={galatGaya}>{tolakan}</p>}
        {host
          ? <button style={button} onClick={() => { setTolakan(null); sambungan.mulai(); }}>Mulai game</button>
          : <p style={{ margin: 0, opacity: 0.8 }}>Menunggu host memulai game…{lobi && ' Kursi kosong diisi bot.'}</p>}
        <button style={tombolKedua} onClick={onKeluar}>Keluar ruang</button>
      </div>
    </div>
  );
}

function KodeUndangan({ kode }: { kode: string }) {
  const [info, setInfo] = useState<string | null>(null);
  const tautan = tautanRuang(kode);
  const bisaBagikan = typeof navigator.share === 'function';
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(tautan);
      setInfo('Tautan tersalin.');
    } catch {
      setInfo(`Salin manual: ${tautan}`);
    }
  };
  const bagikan = async () => {
    try {
      await navigator.share({ title: 'Main gaple', text: `Gabung ke ruang gaple, kode ${kode}`, url: tautan });
    } catch { /* dibatalkan pengguna */ }
  };
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '10px 0', borderRadius: 12, background: 'rgba(0,0,0,.25)' }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Kode undangan</span>
      <strong data-testid="kode-undangan" style={{ fontSize: 40, letterSpacing: 6, fontFamily: 'ui-monospace, monospace' }}>{kode}</strong>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={tombolKecil} onClick={salin}>Salin tautan</button>
        {bisaBagikan && <button style={tombolKecil} onClick={bagikan}>Bagikan</button>}
      </div>
      {info && <span style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-all', textAlign: 'center' }}>{info}</span>}
    </div>
  );
}

function Konfigurasi({ sambungan, lobi, host }: { sambungan: SambunganRuang; lobi: LobiKlien; host: boolean }) {
  const [target, setTarget] = useState(String(lobi.targetPoin));
  // Ikuti nilai server (misalnya setelah host lain atau penolakan) selama tidak sedang diketik.
  const mengetik = useRef(false);
  useEffect(() => { if (!mengetik.current) setTarget(String(lobi.targetPoin)); }, [lobi.targetPoin]);

  if (!host) {
    return (
      <p style={{ margin: 0, fontSize: 15 }} data-testid="konfigurasi">
        Target <strong>{lobi.targetPoin}</strong> poin · Balak ganda <strong>{lobi.balakGanda ? 'aktif' : 'mati'}</strong>
      </p>
    );
  }
  const kirimTarget = () => {
    mengetik.current = false;
    const n = Number(target);
    if (n !== lobi.targetPoin) sambungan.aturKonfigurasi({ targetPoints: n, doubleBalak: lobi.balakGanda });
  };
  return (
    <div style={{ display: 'grid', gap: 10, fontSize: 15 }} data-testid="konfigurasi">
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        Target poin
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={TARGET_POIN_MAKS}
          value={target}
          onFocus={() => { mengetik.current = true; }}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={kirimTarget}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...masukan, width: 90, padding: '6px 10px' }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={lobi.balakGanda}
          onChange={(e) => sambungan.aturKonfigurasi({ targetPoints: lobi.targetPoin, doubleBalak: e.target.checked })}
        />
        Balak ganda
      </label>
    </div>
  );
}
