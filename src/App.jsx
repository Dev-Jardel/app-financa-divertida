import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore'; 
import { DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, Trophy, User, Users, CircleCheck, Coins, PiggyBank, Zap, Home, Car, GlassWater, Heart, ShoppingCart, LogIn, Mail, Lock, LogOut, RefreshCw, AlertTriangle, ShieldCheck, UserPlus, Copy, CheckCircle2, Share2, ChevronDown, ChevronUp } from 'lucide-react';

// --- VERSÃO DO APP ---
const APP_VERSION = '2.4.1'; 

// --- CONFIGURAÇÃO FIREBASE ---
const userManualConfig = {
    apiKey: "AIzaSyBIDk-9N7ds2po39UdhJF_dOcsS4EVWX7g",
    authDomain: "app-financa-divertida.firebaseapp.com",
    projectId: "app-financa-divertida",
    storageBucket: "app-financa-divertida.firebasestorage.app",
    messagingSenderId: "371447740543",
    appId: "1:371447740543:web:9050ac139aa7b3777eba74a"
};

const envConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const firebaseConfig = Object.keys(envConfig).length > 0 ? envConfig : userManualConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const formatCurrency = (amount) => {
    const num = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

// --- CONFIGURAÇÕES DE HUMOR E CATEGORIAS ---
const INCOME_CATEGORIES = {
    salary: { label: 'Salário/Rendimento Fixo', icon: DollarSign, flow: 'income' },
    extra: { label: 'Trabalho/Renda Extra', icon: Zap, flow: 'income' },
    gift: { label: 'Presente/Doação', icon: Heart, flow: 'income' },
    sale: { label: 'Venda de Bens/Serviços', icon: ShoppingCart, flow: 'income' },
    other_income: { label: 'Outras Entradas', icon: CircleCheck, flow: 'income' },
};

const EXPENSE_CATEGORIES = {
    food: { label: 'Comida/Mercado', icon: GlassWater, message: "Você gasta muito dinheiro com comida, seu guloso! Será que não dá para cozinhar mais em casa?", flow: 'expense' },
    housing: { label: 'Moradia/Contas', icon: Home, message: "As contas de casa estão pesando! É hora de caçar vazamentos ou negociar tarifas, hein?", flow: 'expense' },
    transport: { label: 'Transporte/Carro', icon: Car, message: "A gasolina tá cara! Pense em caronas, bicicleta ou transporte público para subir no ranking.", flow: 'expense' },
    leisure: { label: 'Lazer/Viagens', icon: Zap, message: "Que vida boa! Mas cuidado, o 'modo férias' pode te levar ao último lugar no ranking!", flow: 'expense' },
    health: { label: 'Saúde/Farmácia', icon: Heart, message: "Investir na saúde é vital, mas confira se não há exageros nas compras!", flow: 'expense' },
    other: { label: 'Outros Gastos', icon: ShoppingCart, message: "Gastos misteriosos? Revele o segredo para a família ou corte o que é desnecessário!", flow: 'expense' },
};

const PAYMENT_METHOD_FEEDBACK = {
    pix: { 
        title: "Alerta de PIX! ⚡",
        message: "O Leão (Receita Federal) tá de olho no seu CPF! Movimentando demais, hein? Cuidado com o #Taxad!",
        color: "bg-orange-600",
        emoji: "🦁"
    },
    card: {
        title: "Paixão Pelo Roxinho 💳",
        message: "Gostando de usar o plástico, né? Lembre-se: o limite é o céu, mas o vencimento é na Terra.",
        color: "bg-purple-600",
        emoji: "💜"
    },
    cash: {
        title: "Modo Subterrâneo 🤫",
        message: "É isso aí! Dinheiro vivo, jogada esperta. Assim o Leãozinho não vê onde o cofrinho cresce.",
        color: "bg-green-600",
        emoji: "😎"
    },
    default: {
        title: "Aguardando Jogadas",
        message: "Registre suas transações para receber o feedback do clã!",
        color: "bg-gray-400",
        emoji: "💡"
    }
};

const ALL_CATEGORIES = { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES };

const getGamificationFeedback = (rank, totalUsers) => {
    if (totalUsers === 0) return { title: "Aguardando Clã!", message: "Cadastre a primeira transação para começar o jogo.", color: "bg-gray-400", emoji: "⏳" };
    const position = rank + 1;
    if (position === 1) return { title: "Super Poupador! 🏆", message: "Você é o mestre das finanças! Continue assim!", color: "bg-green-500", emoji: "✨" };
    if (position === totalUsers && totalUsers > 1) return { title: "Gastador Profissional... 😅", message: `Último lugar (${position}º). As moedas estão voando!`, color: "bg-red-500", emoji: "💸" };
    if (position <= Math.ceil(totalUsers / 2)) return { title: "Na Média! 📈", message: `Na frente de alguns (${position}º)! Foco total.`, color: "bg-yellow-500", emoji: "🎯" };
    return { title: "Alerta de Gastos! 🚨", message: `Quase no fim da fila (${position}º). Hora de apertar o cinto.`, color: "bg-orange-500", emoji: "👀" };
};

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [familyId, setFamilyId] = useState(null);
    const [familyData, setFamilyData] = useState(null);
    const [userStatus, setUserStatus] = useState(null);
    const [members, setMembers] = useState({});
    const [transactions, setTransactions] = useState([]);
    
    // UI states
    const [type, setType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState('cash');
    const [category, setCategory] = useState('food');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Histórico inicia recolhido

    // --- FIREBASE INIT ---
    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        setDb(firestore);
        setAuth(authInstance);
        return onAuthStateChanged(authInstance, (u) => {
            setUser(u);
            if (!u) { setFamilyId(null); setLoading(false); }
        });
    }, []);

    // --- USER CONTEXT ---
    useEffect(() => {
        if (!db || !user) return;
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
        return onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFamilyId(data.familyId);
                setUserStatus(data.status);
            }
            setLoading(false);
        });
    }, [db, user]);

    // --- FAMILY DATA ---
    useEffect(() => {
        if (!db || !familyId) return;
        const familyRef = doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId);
        const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'members');
        const transRef = collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'transactions');

        const unsubFamily = onSnapshot(familyRef, (s) => setFamilyData(s.data()));
        const unsubMembers = onSnapshot(membersRef, (s) => {
            const m = {};
            s.docs.forEach(d => m[d.id] = d.data());
            setMembers(m);
        });
        
        let unsubTrans = () => {};
        if (userStatus === 'approved') {
            unsubTrans = onSnapshot(transRef, (s) => {
                const t = s.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() || new Date() }));
                setTransactions(t.sort((a,b) => b.timestamp - a.timestamp));
            });
        }
        return () => { unsubFamily(); unsubMembers(); unsubTrans(); };
    }, [db, familyId, userStatus]);

    // --- CÁLCULOS ---
    const stats = useMemo(() => {
        if (!user || !familyId) return null;

        let familyBalance = 0;
        const userNetFlows = {};
        const methodVolume = { pix: 0, card: 0, cash: 0 };
        const catVolume = {};

        Object.keys(members).forEach(mId => {
            if (members[mId].status === 'approved') {
                userNetFlows[mId] = { id: mId, name: members[mId].displayName, net: 0 };
            }
        });

        transactions.forEach(t => {
            const amt = t.amount || 0;
            if (t.type === 'income') {
                familyBalance += amt;
                if (userNetFlows[t.userId]) userNetFlows[t.userId].net += amt;
            } else {
                familyBalance -= amt;
                if (userNetFlows[t.userId]) userNetFlows[t.userId].net -= amt;
                catVolume[t.category] = (catVolume[t.category] || 0) + amt;
            }
            if (methodVolume.hasOwnProperty(t.method)) methodVolume[t.method] += amt;
        });

        const leaderboard = Object.values(userNetFlows).sort((a, b) => b.net - a.net);
        const myRank = leaderboard.findIndex(m => m.id === user.uid);
        const myNet = userNetFlows[user.uid]?.net || 0;

        let topMethod = 'default';
        let maxM = 0;
        Object.keys(methodVolume).forEach(k => { if (methodVolume[k] > maxM) { maxM = methodVolume[k]; topMethod = k; } });

        let topCat = null;
        let maxC = 0;
        Object.keys(catVolume).forEach(k => { if (catVolume[k] > maxC) { maxC = catVolume[k]; topCat = k; } });

        return {
            familyBalance,
            myNet,
            leaderboard,
            myRank,
            methodFeedback: PAYMENT_METHOD_FEEDBACK[topMethod],
            catFeedback: topCat ? (EXPENSE_CATEGORIES[topCat] || { message: "Gastos variados detectados." }) : { message: "Nenhum gasto registrado ainda." }
        };
    }, [transactions, members, user, familyId]);

    // --- ACTIONS ---
    const approveMember = async (mId) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'members', mId), { status: 'approved' });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', mId), { status: 'approved' });
        } catch (e) { console.error(e); }
    };

    const submitTransaction = async (e) => {
        e.preventDefault();
        const num = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
        if (isNaN(num)) return;
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'transactions'), {
                userId: user.uid,
                userName: members[user.uid]?.displayName || 'Membro',
                type, amount: num, description, method, category, timestamp: serverTimestamp()
            });
            setAmount(''); setDescription('');
        } catch (e) { console.error(e); }
    };

    // --- RENDERS ---
    if (loading) return <div className="h-screen flex items-center justify-center bg-indigo-50"><RefreshCw className="animate-spin text-indigo-600 w-8 h-8" /></div>;
    if (!user) return <AuthScreen authInstance={auth} />;
    if (!familyId) return <Onboarding user={user} db={db} appId={appId} />;
    if (userStatus === 'pending') return <PendingScreen familyName={familyData?.name} onSignOut={() => signOut(auth)} />;

    const isAdmin = familyData?.adminId === user.uid;
    const pendingMembers = Object.entries(members).filter(([_, m]) => m.status === 'pending');
    const rankFeedback = getGamificationFeedback(stats?.myRank, stats?.leaderboard.length);

    return (
        <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 font-sans">
            {/* Header atualizado conforme pedido: Família + Nome */}
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-40 border-b border-indigo-100">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-lg"><PiggyBank className="w-6 h-6 text-white" /></div>
                    <div>
                        <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight leading-none">
                            Família {familyData?.name}
                        </h1>
                        <button onClick={() => {navigator.clipboard.writeText(familyId); alert("Código copiado!")}} className="flex items-center space-x-1 mt-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition group">
                            <span className="text-[10px] font-mono font-black text-indigo-600">CODE: {familyId}</span>
                            <Share2 className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600" />
                        </button>
                    </div>
                </div>
                <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-red-500 transition hover:bg-red-50 rounded-full"><LogOut className="w-5 h-5" /></button>
            </header>

            <main className="p-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Dashboard Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-[24px] shadow-lg border-l-8 border-indigo-600 flex flex-col justify-between h-32 relative overflow-hidden group">
                            <div className="z-10">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Saldo Geral da Casa</p>
                                <p className={`text-2xl font-black ${stats?.familyBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(stats?.familyBalance)}
                                </p>
                            </div>
                            <DollarSign className="absolute -right-2 -bottom-2 w-16 h-16 text-indigo-600 opacity-10 group-hover:scale-110 transition" />
                        </div>

                        <div className="bg-white p-5 rounded-[24px] shadow-lg border-l-8 border-purple-600 flex flex-col justify-between h-32 relative overflow-hidden group">
                            <div className="z-10">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Seu Saldo Líquido</p>
                                <p className={`text-2xl font-black ${stats?.myNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {formatCurrency(stats?.myNet)}
                                </p>
                            </div>
                            <User className="absolute -right-2 -bottom-2 w-16 h-16 text-purple-600 opacity-10 group-hover:scale-110 transition" />
                        </div>

                        <div className="bg-white p-5 rounded-[24px] shadow-lg border-l-8 border-yellow-500 flex flex-col justify-between h-32 relative overflow-hidden group">
                            <div className="z-10">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sua Posição</p>
                                <p className="text-2xl font-black text-yellow-600 flex items-center">
                                    <Trophy className="w-6 h-6 mr-2" />
                                    {stats?.myRank !== -1 ? `#${stats.myRank + 1}` : 'N/A'}
                                </p>
                            </div>
                            <Users className="absolute -right-2 -bottom-2 w-16 h-16 text-yellow-500 opacity-10 group-hover:scale-110 transition" />
                        </div>
                    </div>
                    
                    {/* Feedbacks de Humor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-5 rounded-[24px] shadow-lg text-white ${rankFeedback.color}`}>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center">
                                {rankFeedback.emoji} {rankFeedback.title}
                            </h3>
                            <p className="font-bold text-sm leading-tight">{rankFeedback.message}</p>
                        </div>
                        <div className={`p-5 rounded-[24px] shadow-lg text-white ${stats?.methodFeedback.color || 'bg-indigo-500'}`}>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center">
                                {stats?.methodFeedback.emoji} {stats?.methodFeedback.title}
                            </h3>
                            <p className="font-bold text-sm leading-tight">{stats?.methodFeedback.message}</p>
                        </div>
                    </div>

                    {/* Fofoca Financeira */}
                    <div className="bg-indigo-100 p-5 rounded-[24px] border-l-8 border-indigo-500">
                        <h3 className="font-black text-indigo-800 uppercase text-xs tracking-widest mb-1">Fofoca da Casa 🤫</h3>
                        <p className="text-indigo-900 font-bold">{stats?.catFeedback.message}</p>
                    </div>

                    {/* Admin Approvals */}
                    {isAdmin && pendingMembers.length > 0 && (
                        <div className="bg-orange-500 p-5 rounded-[24px] shadow-lg text-white">
                            <h3 className="font-black uppercase text-xs mb-3 flex items-center"><UserPlus className="w-5 h-5 mr-2" /> Pedidos de Entrada</h3>
                            {pendingMembers.map(([id, m]) => (
                                <div key={id} className="flex items-center justify-between bg-white/20 p-3 rounded-xl mb-2">
                                    <span className="font-bold">{m.displayName}</span>
                                    <button onClick={() => approveMember(id)} className="bg-white text-orange-600 px-4 py-1.5 rounded-lg text-xs font-black">APROVAR</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ranking Interativo */}
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black text-gray-800 flex items-center mb-6"><Trophy className="w-6 h-6 mr-3 text-yellow-500" /> Ranking do Clã</h2>
                        <div className="space-y-3">
                            {stats?.leaderboard.map((m, idx) => (
                                <div key={m.id} className={`flex items-center justify-between p-5 rounded-[24px] ${m.id === user.uid ? 'bg-indigo-600 text-white shadow-xl' : 'bg-gray-50'}`}>
                                    <div className="flex items-center space-x-4">
                                        <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-xs ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-400'}`}>#{idx + 1}</span>
                                        <span className="font-black text-lg">{m.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">Saldo Líquido</p>
                                        <p className="font-mono font-black text-xl">{formatCurrency(m.net)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Últimas Jogadas com Toggle (Inicia escondido) */}
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 transition-all duration-300">
                        <button 
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className="w-full flex justify-between items-center group"
                        >
                            <h2 className="text-2xl font-black text-gray-800 flex items-center">
                                <Wallet className="w-6 h-6 mr-3 text-indigo-600" /> Últimas Jogadas
                            </h2>
                            <div className="bg-gray-100 p-2 rounded-full group-hover:bg-indigo-50 transition">
                                {isHistoryOpen ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-indigo-600" />}
                            </div>
                        </button>

                        {isHistoryOpen && (
                            <div className="space-y-3 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                {transactions.length === 0 ? (
                                    <div className="text-center py-10 opacity-30 font-black uppercase text-xs tracking-widest">Nenhuma movimentação ainda</div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {transactions.map(t => (
                                            <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{t.type === 'income' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}</div>
                                                    <div>
                                                        <p className="font-black text-gray-800 leading-tight">{t.description}</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t.userName} • {ALL_CATEGORIES[t.category]?.label || t.category}</p>
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-black text-lg ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Formulário Lateral */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-indigo-50 sticky top-24">
                        <h2 className="text-3xl font-black text-gray-900 mb-8 leading-tight">Nova<br/>Jogada 💰</h2>
                        <form onSubmit={submitTransaction} className="space-y-6">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition ${type === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-gray-400'}`}>Entrada</button>
                                <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition ${type === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>Saída</button>
                            </div>
                            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" className="w-full text-4xl font-black text-center py-6 bg-gray-50 rounded-[24px] outline-none transition" required />
                            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que foi?" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold" required />
                            <div className="grid grid-cols-2 gap-4">
                                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-black text-xs uppercase appearance-none cursor-pointer"><option value="cash">Dinheiro</option><option value="pix">PIX</option><option value="card">Cartão</option></select>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-black text-xs uppercase appearance-none cursor-pointer">{Object.entries(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                            </div>
                            <button type="submit" className={`w-full py-5 rounded-[28px] text-white font-black text-xl shadow-lg transition active:scale-95 ${type === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>SALVAR AGORA</button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

// --- SUB-COMPONENTS ---
const AuthScreen = ({ authInstance }) => {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            if (mode === 'login') await signInWithEmailAndPassword(authInstance, email, password);
            else await createUserWithEmailAndPassword(authInstance, email, password);
        } catch (e) { setError("Falha na autenticação."); }
        finally { setLoading(false); }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-indigo-600 p-4">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-md text-center">
                <div className="bg-indigo-600 p-4 rounded-3xl rotate-12 inline-block mb-4"><PiggyBank className="w-10 h-10 text-white" /></div>
                <h2 className="text-3xl font-black mb-2">{mode === 'login' ? 'Bora entrar!' : 'Nova conta!'}</h2>
                <form onSubmit={handleAuth} className="space-y-4 mt-6">
                    <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" required />
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" required />
                    {error && <p className="text-red-500 text-xs font-black">{error}</p>}
                    <button disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px] shadow-lg">
                        {loading ? 'CARREGANDO...' : (mode === 'login' ? 'ENTRAR AGORA' : 'CRIAR CONTA')}
                    </button>
                </form>
                <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {mode === 'login' ? 'Cadastre-se aqui' : 'Já tem conta? Entre'}
                </button>
            </div>
        </div>
    );
};

const Onboarding = ({ user, db, appId }) => {
    const [view, setView] = useState('choice'); 
    const [userName, setUserName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [familyCode, setFamilyCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!userName.trim() || !familyName.trim()) return setError("Preencha tudo!");
        setLoading(true);
        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { name: familyName, code, adminId: user.uid, createdAt: serverTimestamp() });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code, 'members', user.uid), { displayName: userName, status: 'approved', role: 'admin' });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { familyId: code, status: 'approved', displayName: userName });
        } catch (e) { setError("Erro ao criar."); }
        finally { setLoading(false); }
    };

    const handleJoin = async () => {
        if (!userName.trim() || !familyCode.trim()) return setError("Preencha tudo!");
        setLoading(true);
        try {
            const familyRef = doc(db, 'artifacts', appId, 'public', 'data', 'families', familyCode);
            if (!(await getDoc(familyRef)).exists()) return setError("Código não existe!");
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyCode, 'members', user.uid), { displayName: userName, status: 'pending', role: 'member' });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { familyId: familyCode, status: 'pending', displayName: userName });
        } catch (e) { setError("Erro ao entrar."); }
        finally { setLoading(false); }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-indigo-600 p-4">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-md">
                {view === 'choice' ? (
                    <div className="text-center">
                        <h2 className="text-3xl font-black mb-8">Como vamos começar?</h2>
                        <button onClick={() => setView('create')} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px] mb-4">CRIAR NOVO CLÃ</button>
                        <button onClick={() => setView('join')} className="w-full border-4 border-indigo-600 text-indigo-600 font-black py-5 rounded-[24px]">ENTRAR COM CÓDIGO</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black">{view === 'create' ? 'Novo Clã' : 'Entrar no Clã'}</h2>
                        <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Seu Nome" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                        {view === 'create' ? 
                            <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Nome da Família" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" /> :
                            <input type="text" value={familyCode} onChange={e => setFamilyCode(e.target.value.toUpperCase())} placeholder="Código de 6 dígitos" className="w-full p-4 bg-orange-50 rounded-2xl outline-none font-bold text-center" />
                        }
                        {error && <p className="text-red-500 text-xs font-black">{error}</p>}
                        <button onClick={view === 'create' ? handleCreate : handleJoin} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px]">
                            {loading ? 'PROCESSANDO...' : 'FINALIZAR'}
                        </button>
                        <button onClick={() => setView('choice')} className="w-full text-xs font-black text-gray-400 uppercase">Voltar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PendingScreen = ({ familyName, onSignOut }) => (
    <div className="h-screen flex items-center justify-center bg-indigo-900 p-6 text-center text-white">
        <div className="max-w-sm">
            <ShieldCheck className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-4 tracking-tight">Acesso Pendente</h2>
            <p className="text-indigo-100 text-lg leading-tight">Aguarde a aprovação do chefe da família <b>{familyName}</b> para entrar no ranking!</p>
            <button onClick={onSignOut} className="mt-10 text-white/50 font-black uppercase text-xs flex items-center mx-auto tracking-widest hover:text-white transition">
                <LogOut className="w-4 h-4 mr-2" /> Sair da conta
            </button>
        </div>
    </div>
);

export default App;