import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// CONFIGURAÇÃO DE ACESSO
const MASTER_KEY = "MURIMED2025"; 

const PRICE_TABLE = {
  Hapvida: {
    "IPSA": { "CLÍNICA MÉDICA": 143.64, "PEDIATRIA": 149.04 },
    "RIBEIRÃO PIRES": { "CLÍNICA MÉDICA": 150.50, "PEDIATRIA": 149.80, "ORTOPEDIA": 148.00, "RETAGUARDA": 165.00 },
    "MAUÁ": { "CLÍNICA MÉDICA": 141.00, "PEDIATRIA": 145.60, "RETAGUARDA": 165.00 },
    "SÃO CAETANO DO SUL": { "CLÍNICA MÉDICA": 141.00, "PEDIATRIA": 145.60 }
  },
  Murimed: {
    "IPSA": { "CLÍNICA MÉDICA": 115.50, "PEDIATRIA": 120.05 },
    "RIBEIRÃO PIRES": { "CLÍNICA MÉDICA": 100.00, "PEDIATRIA": 108.33, "ORTOPEDIA": 108.33, "RETAGUARDA": 136.12 },
    "MAUÁ": { "CLÍNICA MÉDICA": 100.00, "PEDIATRIA": 108.33, "RETAGUARDA": 136.12 },
    "SÃO CAETANO DO SUL": { "CLÍNICA MÉDICA": 100.00, "PEDIATRIA": 108.33 }
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [entries, setEntries] = useState([]);
  const [hourlyRate, setHourlyRate] = useState(143.64);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  const [selPlan, setSelPlan] = useState('Hapvida');
  const [selUnit, setSelUnit] = useState('IPSA');
  const [selSpecialty, setSelSpecialty] = useState('CLÍNICA MÉDICA');

  // Verifica persistência de acesso
  useEffect(() => {
    const isAuth = sessionStorage.getItem('murimed_session_active') === 'true';
    if (isAuth) setIsAuthenticated(true);
  }, []);

  // Atualiza taxa baseada na seleção
  useEffect(() => {
    const planData = PRICE_TABLE[selPlan];
    const unitData = planData[selUnit];
    if (unitData && unitData[selSpecialty]) {
      setHourlyRate(unitData[selSpecialty]);
    }
  }, [selPlan, selUnit, selSpecialty]);

  // Carrega registros salvos
  useEffect(() => {
    const saved = localStorage.getItem('murimed_records_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.entries) setEntries(parsed.entries);
      } catch (e) { console.error("Erro ao carregar dados", e); }
    }
  }, []);

  // Salva registros
  useEffect(() => {
    localStorage.setItem('murimed_records_db', JSON.stringify({ entries }));
  }, [entries]);

  const handleLogin = (e) => {
    e.preventDefault();
    // Normalização para evitar erros de digitação (espaços e maiúsculas/minúsculas)
    if (accessKeyInput.trim().toUpperCase() === MASTER_KEY) {
      setIsAuthenticated(true);
      sessionStorage.setItem('murimed_session_active', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
      setAccessKeyInput('');
      setTimeout(() => setLoginError(false), 3000);
    }
  };

  const addEntry = (e) => {
    e.preventDefault();
    if (!hours && !minutes && !description) return;
    const newEntry = {
      id: Math.random().toString(36).substr(2, 9),
      description: description || `${selUnit} - ${selSpecialty}`,
      hours: parseInt(hours) || 0,
      minutes: parseInt(minutes) || 0,
      date: new Date().toLocaleDateString('pt-BR'),
      plan: selPlan,
      rate: hourlyRate
    };
    setEntries([...entries, newEntry]);
    setDescription(''); setHours(''); setMinutes('');
  };

  const stats = useMemo(() => {
    let hapTotal = 0;
    let muriTotal = 0;
    let totalMins = 0;
    entries.forEach(e => {
      const value = ((e.hours * 60 + e.minutes) / 60) * e.rate;
      totalMins += (e.hours * 60 + e.minutes);
      if (e.plan === 'Hapvida') hapTotal += value;
      else muriTotal += value;
    });
    return {
      formattedTime: `${Math.floor(totalMins / 60)}h ${(totalMins % 60).toString().padStart(2, '0')}m`,
      hapvida: hapTotal,
      murimed: muriTotal,
      grandTotal: hapTotal + muriTotal
    };
  }, [entries]);

  const handleAiAnalysis = async () => {
    if (entries.length === 0) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const summary = entries.map(e => `- [${e.plan}] ${e.description}: ${e.hours}h${e.minutes}m (R$${e.rate}/h)`).join('\n');
      const prompt = `Analise profissionalmente os registros de honorários médicos da Murimed. 
      Hapvida: R$ ${stats.hapvida.toFixed(2)}. 
      Murimed: R$ ${stats.murimed.toFixed(2)}. 
      Total: R$ ${stats.grandTotal.toFixed(2)}. 
      Tempo Total: ${stats.formattedTime}. 
      Registros:\n${summary}\nCrie um relatório executivo e profissional em Português do Brasil.`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt 
      });
      setAiReport(response.text);
    } catch (err) {
      setAiReport("Erro: Configure a chave de API para habilitar a inteligência artificial.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // TELA DE ACESSO
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 to-indigo-50">
        <div className="max-w-md w-full glass p-10 rounded-[2.5rem] shadow-2xl border border-white text-center">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-100">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase mb-2">Área Restrita</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-10">Murimed Serviços Médicos</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input 
                type="password" 
                placeholder="Insira sua Chave" 
                value={accessKeyInput} 
                onChange={e => setAccessKeyInput(e.target.value)}
                autoFocus
                className={`w-full bg-slate-50 border ${loginError ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-200'} rounded-2xl py-4 px-6 text-center text-lg font-bold tracking-widest focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all`}
              />
              {loginError && <p className="text-red-500 text-[10px] font-black uppercase mt-3 tracking-widest animate-pulse">Chave Incorreta. Tente novamente.</p>}
            </div>
            <button className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all uppercase text-[11px] tracking-[0.2em] active:scale-[0.98]">
              Acessar Calculadora
            </button>
          </form>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Powered by Trafer Digital</p>
          </div>
        </div>
      </div>
    );
  }

  // APLICAÇÃO PRINCIPAL
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-100">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tighter leading-none uppercase">
                Murimed <span className="text-indigo-600">Serviços Médicos</span>
              </h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Honorários Profissionais</p>
            </div>
          </div>
          
          <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="text-right border-r pr-4 border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block leading-none">Taxa</span>
              <span className="text-lg font-black text-indigo-600">{formatCurrency(hourlyRate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Ajuste</span>
              <input type="number" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} className="w-20 text-xs bg-slate-50 p-1.5 rounded font-bold text-slate-500 outline-none border border-transparent focus:border-indigo-100" />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 no-print">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Seleção de Unidade
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Plano</label>
                <select value={selPlan} onChange={e => { setSelPlan(e.target.value); setSelUnit(Object.keys(PRICE_TABLE[e.target.value])[0]); }} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
                  <option value="Hapvida">Hapvida</option>
                  <option value="Murimed">Murimed</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Unidade</label>
                <select value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelSpecialty(Object.keys(PRICE_TABLE[selPlan][e.target.value])[0]); }} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
                  {Object.keys(PRICE_TABLE[selPlan]).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Especialidade</label>
                <select value={selSpecialty} onChange={e => setSelSpecialty(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer">
                  {Object.keys(PRICE_TABLE[selPlan][selUnit] || {}).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <form onSubmit={addEntry} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Descrição</label>
                <input type="text" placeholder="Ex: Plantão Extra" value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-100 bg-slate-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Horas</label>
                  <input type="number" placeholder="00" value={hours} onChange={e => setHours(e.target.value)} className="w-full border border-slate-100 bg-slate-50 rounded-xl p-3 text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Mins</label>
                  <input type="number" placeholder="00" value={minutes} onChange={e => setMinutes(e.target.value)} className="w-full border border-slate-100 bg-slate-50 rounded-xl p-3 text-sm font-bold" />
                </div>
              </div>
              <button className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-700 text-xs tracking-widest transition-all shadow-lg active:scale-95 uppercase">Adicionar Registro</button>
            </form>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 border-l-4 border-l-cyan-500 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Total Hapvida</span>
            <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.hapvida)}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 border-l-4 border-l-rose-500 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Total Murimed</span>
            <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.murimed)}</p>
          </div>
          <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 text-white">
            <span className="text-[10px] font-black text-indigo-200 uppercase block mb-2">Consolidado</span>
            <p className="text-2xl font-black">{formatCurrency(stats.grandTotal)}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Carga Horária</span>
            <p className="text-2xl font-black">{stats.formattedTime}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
          <div className="px-8 py-6 bg-slate-50/50 border-b flex flex-wrap gap-4 justify-between items-center no-print">
            <h2 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Listagem de Honorários</h2>
            <div className="flex gap-2">
              <button onClick={handleAiAnalysis} disabled={isAnalyzing || entries.length === 0} className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-[10px] font-black hover:scale-105 transition-all shadow-md disabled:opacity-50">
                {isAnalyzing ? '...' : '✨ IA'}
              </button>
              <button onClick={() => window.print()} className="bg-white border border-slate-200 px-5 py-2.5 rounded-full text-[10px] font-black hover:bg-slate-50">PDF</button>
              <button onClick={() => confirm('Limpar todos os dados?') && setEntries([])} className="bg-red-50 text-red-500 px-5 py-2.5 rounded-full text-[10px] font-black">LIMPAR</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                  <th className="px-8 py-5">Convênio</th>
                  <th className="px-8 py-5">Descrição</th>
                  <th className="px-8 py-5">Tempo</th>
                  <th className="px-8 py-5 text-right">Líquido</th>
                  <th className="px-8 py-5 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Nenhum registro encontrado</td></tr>
                ) : (
                  entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter ${e.plan === 'Hapvida' ? 'bg-cyan-100 text-cyan-700' : 'bg-rose-100 text-rose-700'}`}>{e.plan}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-700">{e.description}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{e.date}</div>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-500">{e.hours}h {e.minutes}m</td>
                      <td className="px-8 py-6 text-right font-black text-indigo-600">{formatCurrency(((e.hours * 60 + e.minutes)/60) * e.rate)}</td>
                      <td className="px-8 py-6 text-right no-print">
                        <button onClick={() => setEntries(entries.filter(x => x.id !== e.id))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {aiReport && (
          <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-8 md:p-12 mb-20 shadow-2xl relative overflow-hidden">
            <h4 className="text-[10px] font-black uppercase tracking-[0.5em] mb-8 text-indigo-400">Relatório de Inteligência Artificial</h4>
            <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">{aiReport}</div>
            <button onClick={() => setAiReport(null)} className="mt-8 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors underline decoration-indigo-500 underline-offset-4">Fechar Análise</button>
          </div>
        )}

        <footer className="text-center pb-20 no-print space-y-6">
          <div className="h-px bg-slate-200 w-24 mx-auto mb-8"></div>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Murimed Serviços Médicos • Consolidado 2025</p>
            <div className="flex flex-col items-center justify-center gap-4 font-bold text-xs uppercase tracking-wider">
              <span className="text-slate-400">Tecnologia desenvolvida por</span>
              <a href="https://wa.me/5511988484500" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600 transition-all flex items-center gap-3 bg-orange-50 px-6 py-3 rounded-full border border-orange-100 hover:shadow-xl hover:-translate-y-1 active:scale-95 group">
                <span className="font-black">Trafer Digital</span>
                <svg className="w-5 h-5 fill-current group-hover:rotate-12 transition-transform" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-4.821 7.454c-1.679 0-3.325-.443-4.779-1.282l-.343-.204-3.559.932.948-3.468-.224-.356C3.861 16.155 3.2 14.28 3.2 12.3c0-5.18 4.214-9.4 9.4-9.4 2.509 0 4.867.977 6.641 2.75 1.774 1.774 2.751 4.133 2.751 6.65 0 5.181-4.214 9.4-9.4 9.4m0-20.2c-5.968 0-10.8 4.832-10.8 10.8 0 1.91.493 3.772 1.429 5.423l-1.52 5.556 5.681-1.491c1.601.873 3.404 1.332 5.232 1.332 5.968 0 10.8-4.832 10.8-10.8s-4.832-10.8-10.8-10.8z"/>
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);