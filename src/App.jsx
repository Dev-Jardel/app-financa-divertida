import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, serverTimestamp, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'; 
import { 
  DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle, Wallet, Trophy, User, Users, 
  CircleCheck, Coins, PiggyBank, Zap, Home, Car, GlassWater, Heart, ShoppingCart, 
  LogIn, Mail, Lock, LogOut, RefreshCw, AlertTriangle, ShieldCheck, UserPlus, 
  Copy, CheckCircle2, Share2, ChevronDown, ChevronUp, Calendar, Plus, X, UserCheck, Trash2, Pencil,
  Banknote, Smartphone, UserX, Crown, Ghost, MessageSquareWarning, Info
} from 'lucide-react';

// --- VERSÃO DO APP ---
const APP_VERSION = '2.12.0'; 

// --- CONFIGURAÇÃO FIREBASE (PROTEGIDA) ---
const userManualConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const envConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const firebaseConfig = Object.keys(envConfig).length > 0 ? envConfig : userManualConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : (firebaseConfig.projectId || 'family-finance-default');

const formatCurrency = (amount) => {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

// --- CONFIGURAÇÕES DE MEIOS DE PAGAMENTO ---
const PAYMENT_METHODS = {
    pix: { label: 'PIX', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
    card: { label: 'Cartão', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
    cash: { label: 'Dinheiro', icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50' }
};

// --- MENSAGENS DE HUMILHAÇÃO (FOFOCA FINANCEIRA) ---
const ROASTS = {
    food: [
        "De novo no iFood? Seu estômago é um buraco negro de dinheiro!",
        "Pedindo comida de novo? Daqui a pouco o motoboy vai ter a chave da sua casa.",
        "Cozinhar em casa não mata ninguém, sabia?",
        "Gastando com lanche enquanto o saldo chora. Prioridades, né?"
    ],
    housing: [
        "O teto tá caro, hein? Já pensou em morar numa barraca no parque?",
        "Essa conta de luz... você tá minerando Bitcoin ou esqueceu o ar ligado?",
        "Moradia é prioridade, mas esse boleto doeu até em mim."
    ],
    transport: [
        "Gasolina ou ouro líquido? Esse carro tá bebendo mais que você no open bar!",
        "Andar a pé faz bem pra saúde e pro bolso, fica a dica.",
        "Uber VIP? O patrão tá podendo, hein!"
    ],
    leisure: [
        "Viajando de novo? O banco mandou dizer que seu limite não é milhas aéreas!",
        "A vida é curta, mas o seu dinheiro tá conseguindo ser mais curto ainda.",
        "Rolezinho caro esse... espero que as fotos pro Instagram tenham valido a pena."
    ],
    health: [
        "Saúde é importante, mas essa farmácia tá ficando sócia do seu salário!",
        "Investindo na imortalidade? Porque o preço tá alto."
    ],
    other: [
        "Gasto misterioso detectado. O que você está escondendo do clã?",
        "Dinheiro na mão é vendaval, e você é um furacão categoria 5!",
        "Parabéns! Você acaba de ficar 5% mais longe do seu sonho."
    ]
};

const INCOME_CATEGORIES = {
    salary: { label: 'Salário/Rendimento Fixo', icon: DollarSign, flow: 'income' },
    extra: { label: 'Trabalho/Renda Extra', icon: Zap, flow: 'income' },
    gift: { label: 'Presente/Doação', icon: Heart, flow: 'income' },
    sale: { label: 'Venda de Bens/Serviços', icon: ShoppingCart, flow: 'income' },
    other_income: { label: 'Outras Entradas', icon: CircleCheck, flow: 'income' },
};

const EXPENSE_CATEGORIES = {
    food: { label: 'Comida/Mercado', icon: GlassWater, flow: 'expense' },
    housing: { label: 'Moradia/Contas', icon: Home, flow: 'expense' },
    transport: { label: 'Transporte/Carro', icon: Car, flow: 'expense' },
    leisure: { label: 'Lazer/Viagens', icon: Zap, flow: 'expense' },
    health: { label: 'Saúde/Farmácia', icon: Heart, flow: 'expense' },
    other: { label: 'Outros Gastos', icon: ShoppingCart, flow: 'expense' },
};

const ALL_CATEGORIES = { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES };

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
    const [recurrentBills, setRecurrentBills] = useState([]);
    
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(null);
    const [copied, setCopied] = useState(false);
    const [roastMessage, setRoastMessage] = useState(null);
    const [expandedSplitId, setExpandedSplitId] = useState(null);

    const [transType, setTransType] = useState('expense');
    const [transAmount, setTransAmount] = useState('');
    const [transDesc, setTransDesc] = useState('');
    const [transMethod, setTransMethod] = useState('pix');
    const [transCategory, setTransCategory] = useState('food');

    const [billName, setBillName] = useState('');
    const [billValue, setBillValue] = useState('');
    const [billDueDay, setBillDueDay] = useState('1');
    const [editingBill, setEditingBill] = useState(null);

    const [paymentValue, setPaymentValue] = useState('');
    const [splitWith, setSplitWith] = useState([]); 

    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        setDb(firestore);
        setAuth(authInstance);
        return onAuthStateChanged(authInstance, (u) => {
            setUser(u);
            if (!u) { setFamilyId(null); setUserStatus(null); setLoading(false); }
        });
    }, []);

    useEffect(() => {
        if (!db || !user) return;
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
        return onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFamilyId(data.familyId || null);
                setUserStatus(data.status || null);
            } else { setFamilyId(null); setUserStatus(null); }
            setLoading(false);
        });
    }, [db, user]);

    useEffect(() => {
        if (!db || !familyId) return;
        const familyRef = doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId);
        const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'members');
        const transRef = collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'transactions');
        const billsRef = collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'recurrent_bills');

        onSnapshot(familyRef, (s) => setFamilyData(s.data()));
        onSnapshot(membersRef, (s) => {
            const m = {};
            s.docs.forEach(d => m[d.id] = d.data());
            setMembers(m);
        });
        
        if (userStatus === 'approved') {
            onSnapshot(transRef, (s) => {
                const t = s.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() || new Date() }));
                setTransactions(t.sort((a,b) => b.timestamp - a.timestamp));
            });
            onSnapshot(billsRef, (s) => {
                const b = s.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecurrentBills(b.sort((a,b) => parseInt(a.dueDay) - parseInt(b.dueDay)));
            });
        }
    }, [db, familyId, userStatus]);

    const stats = useMemo(() => {
        if (!user || !familyId || Object.keys(members).length === 0) return null;
        let familyBalance = 0;
        const userNetFlows = {};
        Object.keys(members).forEach(mId => {
            if (members[mId].status === 'approved') userNetFlows[mId] = { id: mId, name: members[mId].displayName, net: 0 };
        });
        transactions.forEach(t => {
            const amt = t.amount || 0;
            if (t.type === 'income') {
                familyBalance += amt;
                if (userNetFlows[t.userId]) userNetFlows[t.userId].net += amt;
            } else {
                familyBalance -= amt;
                if (userNetFlows[t.userId]) userNetFlows[t.userId].net -= amt;
            }
        });
        const leaderboard = Object.values(userNetFlows).sort((a, b) => b.net - a.net);
        return { familyBalance, myNet: userNetFlows[user.uid]?.net || 0, leaderboard, myRank: leaderboard.findIndex(m => m.id === user.uid) };
    }, [transactions, members, user, familyId]);

    const getBillStatus = (dueDay, lastPaidMonth) => {
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${today.getMonth() + 1}`;
        if (lastPaidMonth === currentMonthStr) return 'paid';
        const dueDayInt = parseInt(dueDay);
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDayInt);
        if (today > dueDate && today.getDate() !== dueDayInt) return 'late';
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 5) return 'warning';
        return 'normal';
    };

    const triggerRoast = (cat) => {
        const catRoasts = ROASTS[cat] || ROASTS.other;
        const randomRoast = catRoasts[Math.floor(Math.random() * catRoasts.length)];
        setRoastMessage(randomRoast);
        setTimeout(() => setRoastMessage(null), 5000);
    };

    const submitQuickTransaction = async (e) => {
        e.preventDefault();
        const num = parseFloat(transAmount.replace(/\./g, '').replace(',', '.'));
        if (isNaN(num) || !transDesc) return;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'transactions'), {
            userId: user.uid, userName: members[user.uid]?.displayName || 'Membro',
            type: transType, amount: num, description: transDesc,
            method: transMethod, category: transCategory, timestamp: serverTimestamp()
        });
        if (transType === 'expense') triggerRoast(transCategory);
        setTransAmount(''); setTransDesc('');
    };

    const handleSaveRecurrentBill = async (e) => {
        e.preventDefault();
        const val = parseFloat(billValue.replace(/\./g, '').replace(',', '.'));
        if (isNaN(val) || !billName) return;
        const data = { name: billName, value: val, dueDay: billDueDay, updatedAt: serverTimestamp() };
        if (editingBill) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'recurrent_bills', editingBill.id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'recurrent_bills'), { ...data, lastPaidMonth: '', createdAt: serverTimestamp() });
        }
        setBillName(''); setBillValue(''); setEditingBill(null); setIsBillModalOpen(false);
    };

    const handlePayBill = async () => {
        const val = parseFloat(paymentValue.replace(/\./g, '').replace(',', '.'));
        if (isNaN(val) || !isPayModalOpen) return;
        const currentMonth = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
        const participantsIds = [user.uid, ...splitWith];
        const perPerson = val / participantsIds.length;
        
        const participantsNames = participantsIds.map(id => members[id]?.displayName || 'Membro');
        const splitGroupId = crypto.randomUUID();

        for (const pId of participantsIds) {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'transactions'), {
                userId: pId, 
                userName: members[pId]?.displayName || 'Membro',
                type: 'expense', 
                amount: perPerson, 
                description: `Pagar: ${isPayModalOpen.name}`,
                method: 'pix', 
                category: 'housing', 
                timestamp: serverTimestamp(),
                isSplit: participantsIds.length > 1,
                splitGroupId: splitGroupId,
                participants: participantsNames
            });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'recurrent_bills', isPayModalOpen.id), { lastPaidMonth: currentMonth });
        triggerRoast('housing');
        setIsPayModalOpen(null); setSplitWith([]); setPaymentValue('');
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-indigo-50"><RefreshCw className="animate-spin text-indigo-600 w-8 h-8" /></div>;
    if (!user) return <AuthScreen authInstance={auth} />;
    if (!familyId) return <Onboarding user={user} db={db} appId={appId} onJoined={(fid, status) => { setFamilyId(fid); setUserStatus(status); }} />;
    if (userStatus === 'pending') return <PendingScreen familyName={familyData?.name} onSignOut={() => signOut(auth)} />;

    const pendingMembers = Object.entries(members).filter(([_, m]) => m.status === 'pending');

    return (
        <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 font-sans text-slate-800">
            {/* FOFOQUEIRO - TOAST */}
            {roastMessage && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-slate-900 text-white p-5 rounded-[24px] shadow-2xl border-2 border-indigo-500 flex items-start space-x-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Ghost className="w-12 h-12" /></div>
                        <div className="bg-indigo-600 p-2 rounded-xl shrink-0"><MessageSquareWarning className="w-5 h-5" /></div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Fofoca Financeira</p>
                            <p className="font-bold text-sm leading-tight italic">"{roastMessage}"</p>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-40 border-b border-indigo-100">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-100"><PiggyBank className="w-6 h-6 text-white" /></div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none flex items-center">Família {familyData?.name || '...'}</h1>
                        <button onClick={() => { navigator.clipboard.writeText(familyId); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="flex items-center space-x-1 group">
                            <span className="text-[10px] font-mono font-black text-indigo-400 group-hover:text-indigo-600 transition-colors tracking-widest uppercase">ID: {familyId}</span>
                            {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-indigo-300 group-hover:text-indigo-500" />}
                        </button>
                    </div>
                </div>
                <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition hover:bg-red-50 rounded-full"><LogOut className="w-5 h-5" /></button>
            </header>

            <main className="p-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
                <div className="lg:col-span-2 space-y-6">
                    {familyData?.adminId === user.uid && pendingMembers.length > 0 && (
                        <div className="bg-yellow-50 p-6 rounded-[32px] border-2 border-yellow-200">
                            <h2 className="text-xl font-black text-yellow-800 flex items-center mb-4"><UserPlus className="mr-3 w-5 h-5" /> Novos Pedidos</h2>
                            <div className="space-y-3">
                                {pendingMembers.map(([mId, m]) => (
                                    <div key={mId} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-yellow-100">
                                        <span className="font-bold text-slate-700">{m.displayName}</span>
                                        <div className="flex space-x-2">
                                            <button onClick={async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'members', mId), { status: 'approved' }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', mId), { status: 'approved' }); }} className="bg-green-500 text-white p-2 rounded-xl"><UserCheck className="w-4 h-4" /></button>
                                            <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'members', mId)); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', mId), { familyId: null, status: null }); }} className="bg-red-500 text-white p-2 rounded-xl"><UserX className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card label="Saldo da Casa" value={stats?.familyBalance || 0} color="indigo" icon={<DollarSign />} />
                        <Card label="Seu Saldo Líquido" value={stats?.myNet || 0} color="purple" icon={<User />} />
                        <Card label="Sua Posição" value={stats && stats.myRank !== -1 ? `#${stats.myRank + 1}` : 'N/A'} color="yellow" icon={<Trophy />} isText />
                    </div>

                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center"><Calendar className="w-6 h-6 mr-3 text-indigo-600" /> Agenda de Contas</h2>
                            <button onClick={() => { setEditingBill(null); setBillName(''); setBillValue(''); setIsBillModalOpen(true); }} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition"><Plus className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recurrentBills.length === 0 ? <p className="col-span-2 text-center py-6 text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhuma conta cadastrada</p> : 
                            recurrentBills.map(bill => {
                                const status = getBillStatus(bill.dueDay, bill.lastPaidMonth);
                                // --- CORES DOS BOLETOS ATUALIZADAS POR VOCÊ ---
                                const statusClasses = { 
                                    paid: 'bg-green-100 border-green-500 opacity-70', 
                                    late: 'bg-red-50 border-red-300 animate-pulse', 
                                    warning: 'bg-yellow-50 border-yellow-300', 
                                    normal: 'bg-slate-50 border-slate-200' 
                                };
                                return (
                                    <div key={bill.id} className={`p-4 rounded-2xl border-2 transition-all relative group ${statusClasses[status]}`}>
                                        <div className="absolute top-3 right-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => { setEditingBill(bill); setBillName(bill.name); setBillValue(String(bill.value).replace('.', ',')); setBillDueDay(bill.dueDay); setIsBillModalOpen(true); }} className="p-1.5 bg-white rounded-lg shadow-sm hover:text-indigo-600"><Pencil className="w-3 h-3" /></button>
                                            <button onClick={async () => { if(confirm("Encerrar conta?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyId, 'recurrent_bills', bill.id)) }} className="p-1.5 bg-white rounded-lg shadow-sm hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                        <h4 className="font-black uppercase text-sm mb-1">{bill.name}</h4>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${status === 'late' ? 'text-red-600' : status === 'warning' ? 'text-yellow-700' : 'text-slate-400'}`}>{status === 'late' ? 'VENCIDO! ' : status === 'warning' ? 'VENCE LOGO! ' : ''}Dia {bill.dueDay}</p>
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono font-black text-lg">{formatCurrency(bill.value)}</span>
                                            {status === 'paid' ? <CheckCircle2 className="text-green-600 w-5 h-5" /> : <button onClick={() => { setIsPayModalOpen(bill); setPaymentValue(String(bill.value).replace('.', ',')); }} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black border border-current shadow-sm hover:scale-105 transition">PAGAR AGORA</button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="w-full flex justify-between items-center group">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center transition-colors group-hover:text-indigo-600"><Wallet className="w-6 h-6 mr-3 text-indigo-600" /> Histórico</h2>
                            <div className="bg-slate-50 p-2 rounded-full">{isHistoryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                        </button>
                        {isHistoryOpen && (
                            <div className="space-y-3 mt-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar animate-in slide-in-from-top-2">
                                {transactions.length === 0 ? <p className="text-center py-10 text-slate-300 font-black uppercase text-xs">Vazio...</p> : 
                                transactions.map(t => {
                                    const method = PAYMENT_METHODS[t.method] || PAYMENT_METHODS.cash;
                                    const category = ALL_CATEGORIES[t.category] || ALL_CATEGORIES.other;
                                    const Icon = category.icon;
                                    const isExpanded = expandedSplitId === t.id;

                                    return (
                                        <div key={t.id} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Icon className="w-5 h-5" /></div>
                                                    <div>
                                                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                            <p className="font-black text-sm text-slate-800">{t.description}</p>
                                                            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full ${method.bg} ${method.color} border border-current/10`}>
                                                                <method.icon className="w-2.5 h-2.5" />
                                                                <span className="text-[8px] font-black uppercase tracking-tighter">{method.label}</span>
                                                            </div>
                                                            {t.isSplit && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setExpandedSplitId(isExpanded ? null : t.id); }}
                                                                    className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm border border-indigo-700"
                                                                >
                                                                    <Users className="w-2.5 h-2.5" />
                                                                    <span className="text-[8px] font-black uppercase tracking-tighter">Rateio</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{t.userName} • {category.label}</p>
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-black ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span>
                                            </div>
                                            
                                            {isExpanded && t.participants && (
                                                <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-100 animate-in slide-in-from-top-2 duration-300">
                                                    <p className="text-[10px] font-black text-indigo-600 uppercase mb-2 flex items-center">
                                                        <Info className="w-3 h-3 mr-1" /> Dividido entre:
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {t.participants.map((p, idx) => (
                                                            <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-[9px] font-black">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[40px] shadow-2xl sticky top-24 border border-indigo-50/50">
                        <h2 className="text-3xl font-black text-slate-900 mb-8 leading-tight tracking-tight">Nova<br/>Jogada 💰</h2>
                        <form onSubmit={submitQuickTransaction} className="space-y-6">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button type="button" onClick={() => { setTransType('income'); setTransCategory('salary'); }} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${transType === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>Entrada</button>
                                <button type="button" onClick={() => { setTransType('expense'); setTransCategory('food'); }} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${transType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>Saída</button>
                            </div>
                            <input type="text" value={transAmount} onChange={e => setTransAmount(e.target.value)} placeholder="R$ 0,00" className="w-full text-4xl font-black text-center py-6 bg-slate-50 rounded-[24px] outline-none border-4 border-transparent focus:border-indigo-500 transition-all" required />
                            
                            {/* --- PLACEHOLDERS CONDICIONAIS ATUALIZADOS POR VOCÊ --- */}
                            <input 
                                type="text" 
                                value={transDesc} 
                                onChange={e => setTransDesc(e.target.value)} 
                                placeholder={transType === 'expense' ? "O que você comprou?" : "De onde veio esse dinheiro?"}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" 
                                required 
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <select value={transMethod} onChange={e => setTransMethod(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs appearance-none outline-none border-2 border-transparent focus:border-indigo-500">
                                    {Object.entries(PAYMENT_METHODS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <select value={transCategory} onChange={e => setTransCategory(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs appearance-none outline-none border-2 border-transparent focus:border-indigo-500">
                                    {Object.entries(transType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </div>
                            <button type="submit" className={`w-full py-5 text-white font-black rounded-[28px] shadow-xl active:scale-95 transition-all ${transType === 'income' ? 'bg-green-500 hover:bg-green-600 shadow-green-100' : 'bg-red-500 hover:bg-red-600 shadow-red-100'}`}>SALVAR JOGADA</button>
                        </form>
                    </div>

                    <div className="mt-6 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center"><Trophy className="w-5 h-5 mr-3 text-yellow-500" /> Ranking Clã</h2>
                        <div className="space-y-3">
                            {stats?.leaderboard.slice(0, 5).map((m, idx) => (
                                <div key={m.id} className={`flex items-center justify-between p-3 rounded-2xl ${m.id === user.uid ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}>
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xs font-black opacity-30">#{idx + 1}</span>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-xs truncate max-w-[80px]">{m.name}</span>
                                            {m.id === familyData?.adminId && <div className="flex items-center text-[8px] font-black text-indigo-500 uppercase tracking-tighter"><Crown className="w-2 h-2 mr-0.5" /> Chefe</div>}
                                        </div>
                                    </div>
                                    <span className="font-mono font-black text-xs">{formatCurrency(m.net)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* MODAIS */}
            {isBillModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md p-8 rounded-[40px] shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900">{editingBill ? 'Editar Conta' : 'Nova Conta'}</h3>
                            <button onClick={() => setIsBillModalOpen(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        
                        {/* --- LABELS NOS FORMULÁRIO DE CONTA ATUALIZADAS POR VOCÊ --- */}
                        <form onSubmit={handleSaveRecurrentBill} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-widest">Qual Conta ?</label>
                                <input type="text" value={billName} onChange={e => setBillName(e.target.value)} placeholder="Ex: Internet" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" required />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-widest">Valor Médio</label>
                                <input type="text" value={billValue} onChange={e => setBillValue(e.target.value)} placeholder="R$ 0,00" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" required />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-widest">Dia do Vencimento</label>
                                <input type="number" min="1" max="31" value={billDueDay} onChange={e => setBillDueDay(e.target.value)} placeholder="Ex: 10" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" required />
                            </div>

                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-[24px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">SALVAR CONTA</button>
                        </form>
                    </div>
                </div>
            )}

            {isPayModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md p-8 rounded-[40px] shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-900">Pagar Conta</h3>
                            <button onClick={() => {setIsPayModalOpen(null); setSplitWith([])}} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="bg-indigo-50 p-6 rounded-3xl mb-8 border border-indigo-100 text-center relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">{isPayModalOpen.name}</p>
                            <input type="text" value={paymentValue} onChange={e => setPaymentValue(e.target.value)} className="w-full bg-transparent text-center text-4xl font-black text-indigo-600 outline-none" />
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 px-2 tracking-widest">Ratear com:</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(members).filter(([id]) => id !== user.uid && members[id].status === 'approved').map(([id, m]) => (
                                    <button key={id} onClick={() => splitWith.includes(id) ? setSplitWith(splitWith.filter(i => i !== id)) : setSplitWith([...splitWith, id])} className={`p-3 rounded-2xl border-2 flex items-center space-x-2 transition-all ${splitWith.includes(id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}><UserCheck className="w-4 h-4" /><span className="font-bold text-xs truncate">{m.displayName}</span></button>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-xl font-black text-slate-800">{formatCurrency(parseFloat(paymentValue.replace(',', '.')) / (splitWith.length + 1))}</p>
                                <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{splitWith.length + 1}x</div>
                            </div>
                            <button onClick={handlePayBill} className="w-full py-5 bg-green-500 text-white font-black rounded-[24px] shadow-xl shadow-green-100 hover:bg-green-600 transition-all active:scale-95">CONFIRMAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Card = ({ label, value, color, icon, isText }) => (
    <div className={`bg-white p-5 rounded-[24px] shadow-lg border-l-8 border-${color}-600 flex flex-col justify-between h-32 relative group overflow-hidden transition-all hover:shadow-xl`}>
        <div className="z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-black ${!isText && value < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {isText ? value : formatCurrency(value)}
            </p>
        </div>
        <div className={`absolute -right-2 -bottom-2 w-16 h-16 text-${color}-600 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500`}>{icon}</div>
    </div>
);

const AuthScreen = ({ authInstance }) => {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const getErrorMessage = (code) => {
        switch (code) {
            case 'auth/weak-password': return 'Senha muito curta! Mínimo 6 dígitos.';
            case 'auth/email-already-in-use': return 'Esse e-mail já tem um clã formado.';
            case 'auth/invalid-email': return 'Esse e-mail parece falso, hein?';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
            default: return 'Ocorreu um erro. Tente novamente.';
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-indigo-600 p-4 font-sans">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
                <div className="bg-indigo-600 p-4 rounded-3xl rotate-12 inline-block mb-6 shadow-xl shadow-indigo-100"><PiggyBank className="w-12 h-12 text-white" /></div>
                <h2 className="text-3xl font-black mb-8 text-slate-900 tracking-tight tracking-tighter">{mode === 'login' ? 'Bora entrar!' : 'Crie seu Clã!'}</h2>
                <form onSubmit={async (e) => { 
                    e.preventDefault(); setLoading(true); setError('');
                    try { 
                        if (mode === 'login') await signInWithEmailAndPassword(authInstance, email, password); 
                        else await createUserWithEmailAndPassword(authInstance, email, password); 
                    } catch (e) { setError(getErrorMessage(e.code)); } finally { setLoading(false); } 
                }} className="space-y-4">
                    <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none transition-all" required />
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none transition-all" required />
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center space-x-2 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-[10px] font-black uppercase text-left leading-tight">{error}</span>
                        </div>
                    )}
                    <button className="w-full bg-indigo-600 text-white font-black py-5 rounded-[28px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50" disabled={loading}>{loading ? 'CARREGANDO...' : (mode === 'login' ? 'ENTRAR AGORA' : 'COMEÇAR JOGO')}</button>
                </form>
                <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">{mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Login'}</button>
            </div>
        </div>
    );
};

const Onboarding = ({ user, db, appId, onJoined }) => {
    const [view, setView] = useState('choice'); 
    const [userName, setUserName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [familyCode, setFamilyCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if(!userName.trim() || !familyName.trim()) return;
        setLoading(true);
        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase(); 
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code), { name: familyName, code, adminId: user.uid, createdAt: serverTimestamp() }); 
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', code, 'members', user.uid), { displayName: userName, status: 'approved', role: 'admin' }); 
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { familyId: code, status: 'approved', displayName: userName }); 
            onJoined(code, 'approved');
        } catch (e) { alert("Erro ao criar clã."); } finally { setLoading(false); }
    };

    const handleJoin = async () => {
        if(!userName.trim() || !familyCode.trim()) return;
        setLoading(true);
        try {
            const familyIdClean = familyCode.trim().toUpperCase();
            const familyRef = doc(db, 'artifacts', appId, 'public', 'data', 'families', familyIdClean);
            const snap = await getDoc(familyRef);
            if(!snap.exists()) { alert("Clã não encontrado!"); return; }
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'families', familyIdClean, 'members', user.uid), { displayName: userName, status: 'pending', role: 'member' }); 
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { familyId: familyIdClean, status: 'pending', displayName: userName }); 
            onJoined(familyIdClean, 'pending');
        } catch (e) { alert("Erro ao entrar no clã."); } finally { setLoading(false); }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-indigo-600 p-4 text-center">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-md animate-in fade-in duration-500">
                {view === 'choice' ? (
                    <>
                        <h2 className="text-3xl font-black mb-8 text-slate-900 tracking-tight tracking-tighter tracking-tight tracking-tight tracking-tight">Bem-vindo(a) ao Clã!</h2>
                        <div className="space-y-4">
                            <button onClick={() => setView('create')} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[28px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">CRIAR NOVO CLÃ</button>
                            <button onClick={() => setView('join')} className="w-full border-4 border-indigo-600 text-indigo-600 font-black py-5 rounded-[28px] hover:bg-indigo-50 transition-all">ENTRAR COM CÓDIGO</button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4 text-left font-sans">
                        <h2 className="text-2xl font-black mb-4 text-slate-900 text-center uppercase tracking-tighter">{view === 'create' ? 'Fundar Família' : 'Entrar no Grupo'}</h2>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Como quer ser chamado?</label>
                            <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Seu Apelido" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
                        </div>
                        {view === 'create' ? (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome do Clã</label>
                                <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Ex: Família Silva" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Código Secreto do Clã</label>
                                <input type="text" value={familyCode} onChange={e => setFamilyCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DE 6 DÍGITOS" className="w-full p-4 bg-orange-50 rounded-2xl font-bold text-center text-xl text-orange-700 border-2 border-transparent focus:border-orange-500 outline-none" />
                            </div>
                        )}
                        <button onClick={view === 'create' ? handleCreate : handleJoin} className="w-full mt-4 bg-indigo-600 text-white font-black py-5 rounded-[28px] shadow-lg disabled:opacity-50" disabled={loading}>{loading ? 'PROCESSANDO...' : 'CONCLUIR'}</button>
                        <button onClick={() => setView('choice')} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 text-center">Voltar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PendingScreen = ({ familyName, onSignOut }) => (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white p-6 text-center animate-in fade-in duration-500 font-sans">
        <div className="max-w-md">
            <ShieldCheck className="w-20 h-20 text-yellow-400 mx-auto mb-6 drop-shadow-lg animate-pulse" />
            <h2 className="text-3xl font-black mb-4 tracking-tight uppercase">Pedido Enviado!</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">O chefe do clã <b>{familyName || '...'}</b> já recebeu seu pedido. <br/>Aguarde a aprovação para começar a jogar!</p>
            <button onClick={onSignOut} className="px-10 py-4 bg-white/10 border border-white/20 rounded-full font-black uppercase text-xs tracking-widest hover:bg-white/20 transition-all">Sair</button>
        </div>
    </div>
);

export default App;