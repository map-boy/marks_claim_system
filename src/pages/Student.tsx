import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dict, type Key } from '../lib/i18n';
import type { Lang, Intake, Problem, ModuleRow } from '../lib/types';

type Step = 'lang' | 'retake' | 'retakeInfo' | 'about' | 'class' | 'hod' | 'problem' | 'done';
type Errors = Partial<Record<string, Key>>;

const BACK: Partial<Record<Step, Step>> = {
  retake: 'lang', retakeInfo: 'retake', about: 'retake',
  class: 'about', hod: 'class', problem: 'class',
};
const DOTS: Step[] = ['about', 'class', 'problem'];

const toLatin = (s: string) => s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660));
const cleanPhone = (s: string) => toLatin(s).replace(/[\s\-()]/g, '');
const phoneOk = (s: string) => /^\+?\d{8,15}$/.test(cleanPhone(s));

const btnPrimary =
  'w-full rounded-full bg-tangerine py-4 text-lg font-semibold text-white shadow-[0_6px_0_#b53b1b] transition active:translate-y-1 active:shadow-none disabled:opacity-50';
const card = 'rounded-[2rem] bg-white/70 p-6 shadow-[0_8px_0_rgba(232,81,42,0.18)]';
const input =
  'w-full rounded-2xl border-2 border-sand bg-white px-4 py-3 text-lg outline-none focus:border-teal';

export default function Student() {
  const [lang, setLang] = useState<Lang>('en');
  const [step, setStep] = useState<Step>('lang');
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [fullName, setFullName] = useState('');
  const [roll, setRoll] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [intake, setIntake] = useState<Intake | ''>('');
  const [moduleId, setModuleId] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [problem, setProblem] = useState<Problem | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Key | ''>('');
  const [ref, setRef] = useState<number | null>(null);

  const t = (k: Key) => dict[lang][k];
  const rtl = lang === 'ar';
  const arrow = rtl ? '\u2190' : '\u2192';
  const selected = modules.find((m) => m.id === moduleId);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);

  useEffect(() => {
    supabase
      .from('modules')
      .select('id,name,lecturer,is_english')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setModules((data ?? []) as ModuleRow[]));
  }, []);

  function check(e: Errors) {
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextAbout() {
    const e: Errors = {};
    if (fullName.trim().length < 3) e.fullName = 'required';
    if (!roll.trim()) e.roll = 'required';
    if (!phoneOk(whatsapp)) e.whatsapp = 'badPhone';
    if (check(e)) setStep('class');
  }

  function nextClass() {
    const e: Errors = {};
    if (!intake) e.intake = 'required';
    if (!moduleId) e.module = 'required';
    else if (selected?.is_english && !lecturer.trim()) e.lecturer = 'required';
    if (!check(e)) return;
    setStep(selected && selected.is_english ? 'problem' : 'hod');
  }

  function pickModule(id: string) {
    setModuleId(id);
    const m = modules.find((x) => x.id === id);
    setLecturer(m?.lecturer ?? '');
  }

  async function submit() {
    if (!problem) { setErrors({ problem: 'required' }); return; }
    setBusy(true);
    setBanner('');
    const { data, error } = await supabase.rpc('submit_problem', {
      p_language: lang,
      p_full_name: fullName.trim(),
      p_roll: toLatin(roll).trim(),
      p_whatsapp: cleanPhone(whatsapp),
      p_intake: intake,
      p_module_id: moduleId,
      p_lecturer: lecturer.trim(),
      p_problem: problem,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) { setBanner(error.code === '23505' ? 'dupe' : 'error'); return; }
    setRef(data as number);
    setStep('done');
  }

  function another() {
    setProblem(''); setNote(''); setRef(null); setBanner(''); setErrors({});
    setStep('class');
  }

  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-sm font-medium text-tangerine">{t(errors[k] as Key)}</p> : null;

  const dotIdx = DOTS.indexOf(step === 'hod' ? 'class' : step);

  return (
    <div className="flex min-h-screen justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* hero */}
        <div className="rounded-[2rem] bg-gradient-to-b from-sky-200 via-orange-100 to-amber-100 p-6 shadow-[0_8px_0_rgba(15,94,92,0.2)]">
          <h1 className="font-display text-4xl font-bold text-tealdark">{t('title')}</h1>
          <p className="mt-2 text-lg font-medium text-tangerine">{t('tagline')}</p>
          {dotIdx >= 0 && (
            <div className="mt-4 flex gap-2">
              {DOTS.map((d, i) => (
                <span key={d} className={`h-2.5 flex-1 rounded-full ${i <= dotIdx ? 'bg-teal' : 'bg-white/70'}`} />
              ))}
            </div>
          )}
        </div>

        {step === 'lang' && (
          <div className={card}>
            <h2 className="mb-4 font-display text-2xl font-bold text-tangerine">
              {dict.en.pickLang} / {dict.ar.pickLang}
            </h2>
            <div className="space-y-3">
              <button className={btnPrimary} onClick={() => { setLang('en'); setStep('retake'); }}>English</button>
              <button className={btnPrimary + ' !bg-teal !shadow-[0_6px_0_#0F5E5C]'} onClick={() => { setLang('ar'); setStep('retake'); }}>العربية</button>
            </div>
          </div>
        )}

        {step === 'retake' && (
          <div className={card}>
            <h2 className="mb-4 font-display text-2xl font-bold text-tangerine">{t('retakeQ')}</h2>
            <div className="space-y-3">
              <button className={btnPrimary} onClick={() => setStep('about')}>{t('retakeNo')}</button>
              <button className={btnPrimary + ' !bg-teal !shadow-[0_6px_0_#0F5E5C]'} onClick={() => setStep('retakeInfo')}>{t('retakeYes')}</button>
            </div>
          </div>
        )}

        {step === 'retakeInfo' && (
          <div className={card}>
            <h2 className="font-display text-2xl font-bold text-tangerine">{t('retakeInfoTitle')}</h2>
            <p className="mt-3 text-lg">{t('retakeInfo')}</p>
          </div>
        )}

        {step === 'about' && (
          <div className={card + ' space-y-4'}>
            <h2 className="font-display text-2xl font-bold text-tangerine">{t('aboutTitle')}</h2>
            <label className="block">
              <span className="font-semibold text-tealdark">{t('fullName')}</span>
              <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              {err('fullName')}
            </label>
            <label className="block">
              <span className="font-semibold text-tealdark">{t('roll')}</span>
              <input className={input} dir="ltr" value={roll} onChange={(e) => setRoll(e.target.value)} />
              {err('roll')}
            </label>
            <label className="block">
              <span className="font-semibold text-tealdark">{t('whatsapp')}</span>
              <input className={input} dir="ltr" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+2507XXXXXXXX" />
              <span className="text-sm opacity-70">{t('whatsappHint')}</span>
              {err('whatsapp')}
            </label>
            <button className={btnPrimary} onClick={nextAbout}>{t('next')} {arrow}</button>
          </div>
        )}

        {step === 'class' && (
          <div className={card + ' space-y-4'}>
            <h2 className="font-display text-2xl font-bold text-tangerine">{t('classTitle')}</h2>
            <div>
              <span className="font-semibold text-tealdark">{t('intake')}</span>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(['september', 'january', 'june'] as Intake[]).map((i) => (
                  <button key={i} onClick={() => setIntake(i)}
                    className={`rounded-full border-2 px-2 py-3 font-semibold ${intake === i ? 'border-teal bg-teal text-white' : 'border-sand bg-white'}`}>
                    {t(('intake_' + i) as Key)}
                  </button>
                ))}
              </div>
              {err('intake')}
            </div>
            <label className="block">
              <span className="font-semibold text-tealdark">{t('module')}</span>
              <select className={input} value={moduleId} onChange={(e) => pickModule(e.target.value)}>
                <option value="">{t('modulePick')}</option>
                {modules.filter((m) => m.is_english).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {err('module')}
            </label>
            {selected?.is_english && (
              <label className="block">
                <span className="font-semibold text-tealdark">{t('lecturer')}</span>
                <input className={input} value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
                {err('lecturer')}
              </label>
            )}
            <button type="button" onClick={() => setStep('hod')} className="w-full rounded-full border-2 border-teal bg-white px-4 py-3 font-semibold text-tealdark">{t('notEnglishBtn')} {arrow}</button>
            <button className={btnPrimary} onClick={nextClass}>{t('next')} {arrow}</button>
          </div>
        )}

        {step === 'hod' && (
          <div className={card}>
            <h2 className="font-display text-2xl font-bold text-tangerine">{t('hodTitle')}</h2>
            <p className="mt-3 text-lg">{t('hodInfo')}</p>
          </div>
        )}

        {step === 'problem' && (
          <div className={card + ' space-y-4'}>
            <h2 className="font-display text-2xl font-bold text-tangerine">{t('problemTitle')}</h2>
            <div className="space-y-3">
              {(['cat2', 'fat', 'both'] as Problem[]).map((p) => (
                <button key={p} onClick={() => setProblem(p)}
                  className={`w-full rounded-2xl border-2 px-4 py-4 text-lg font-semibold ${problem === p ? 'border-teal bg-teal text-white' : 'border-sand bg-white'}`}>
                  {t(p)}
                </button>
              ))}
              {err('problem')}
            </div>
            <p className="text-sm opacity-70">{t('cat1Note')}</p>
            <label className="block">
              <span className="font-semibold text-tealdark">{t('noteLabel')}</span>
              <textarea className={input} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {banner && <p className="rounded-2xl bg-orange-100 p-3 font-medium text-tangerine">{t(banner)}</p>}
            <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? t('sending') : t('submit')}</button>
          </div>
        )}

        {step === 'done' && (
          <div className={card + ' text-center'}>
            <h2 className="font-display text-3xl font-bold text-teal">{t('doneTitle')}</h2>
            <p className="mt-2 text-lg">{t('doneText')}</p>
            <p className="mt-4 text-sm uppercase tracking-wide opacity-70">{t('ref')}</p>
            <p className="font-display text-5xl font-bold text-tangerine">#{ref}</p>
            <button className={btnPrimary + ' mt-5'} onClick={another}>{t('again')}</button>
          </div>
        )}

        {BACK[step] && (
          <button onClick={() => { setErrors({}); setBanner(''); setStep(BACK[step] as Step); }}
            className="mx-auto block rounded-full px-6 py-2 font-semibold text-tealdark underline">
            {t('back')}
          </button>
        )}
      </div>
    </div>
  );
}