"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Loader2, Plus, ArrowUpRight, ArrowDownRight, CreditCard, PieChart as PieChartIcon, TrendingUp, LogOut, Trash2, Edit2, Target } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type Transaction = {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
};

type Budget = {
  id: string;
  category: string;
  limit: number;
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function Dashboard() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', category: '', description: '', type: '' });

  // Budget State
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: '', limit: '' });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchTransactions();
    fetchBudgets();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    }
  };

  const fetchBudgets = async () => {
    try {
      const res = await fetch("/api/budgets");
      if (res.ok) {
        const data = await res.json();
        setBudgets(data);
      }
    } catch (error) {
      console.error("Failed to fetch budgets", error);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (res.ok) fetchTransactions();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ amount: t.amount.toString(), category: t.category, description: t.description || '', type: t.type });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditingId(null);
        fetchTransactions();
      }
    } catch (error) {
      console.error("Failed to update", error);
    }
  };

  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetForm)
      });
      if (res.ok) {
        setShowBudgetForm(false);
        setBudgetForm({ category: '', limit: '' });
        fetchBudgets();
      }
    } catch (error) {
      console.error("Failed to save budget", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processAudio(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudio = async (audioBlob: Blob, mimeType: string) => {
    setIsProcessing(true);
    const formData = new FormData();
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    formData.append("audio", audioBlob, `recording.${ext}`);

    try {
      const res = await fetch("/api/process-audio", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchTransactions();
      } else {
        const error = await res.json();
        alert(`Error processing audio: ${error.details || error.error}`);
      }
    } catch (error) {
      console.error("Error sending audio:", error);
      alert("Failed to connect to the server.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate totals
  const totalRevenue = transactions.filter(t => t.type === "REVENUE").reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
  const balance = totalRevenue - totalExpense;

  // Process chart data
  const getChartData = () => {
    const data = [];
    const today = new Date();
    
    if (timeRange === 'week' || timeRange === 'month') {
      const days = timeRange === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const dayExpense = transactions.filter(t => t.type === 'EXPENSE' && t.date.startsWith(dateString)).reduce((sum, t) => sum + t.amount, 0);
        data.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), Expense: dayExpense });
      }
    } else if (timeRange === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthPrefix = d.toISOString().substring(0, 7);
        const monthExpense = transactions.filter(t => t.type === 'EXPENSE' && t.date.startsWith(monthPrefix)).reduce((sum, t) => sum + t.amount, 0);
        data.push({ date: d.toLocaleDateString('en-US', { month: 'short' }), Expense: monthExpense });
      }
    }
    return data;
  };
  const chartData = getChartData();

  // Process pie chart data (Category breakdown for expenses)
  const categoryDataMap = new Map<string, number>();
  transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
    categoryDataMap.set(t.category, (categoryDataMap.get(t.category) || 0) + t.amount);
  });
  const pieData = Array.from(categoryDataMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      <header style={{ marginBottom: '40px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Lumera Finance</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Your AI-powered personal finance keeper.</p>
        </div>
        <button onClick={handleLogout} className="btn-icon" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
          <LogOut size={20} />
        </button>
      </header>

      <div className="grid-dashboard">
        {/* Balance Card */}
        <div className="glass-panel col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} /> Total Balance
          </h2>
          <h3 style={{ fontSize: '3rem', fontWeight: '700' }}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Revenue</p>
              <p style={{ fontSize: '1.25rem', color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                <ArrowUpRight size={20} /> ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Expenses</p>
              <p style={{ fontSize: '1.25rem', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}>
                <ArrowDownRight size={20} /> ₹{totalExpense.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* AI Input Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>AI Voice Entry</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Speak your expense in Malayalam or English.
            </p>
          </div>
          <button 
            className={`btn-icon ${isRecording ? 'animate-pulse-glow' : ''}`}
            style={{ 
              background: isRecording ? 'var(--danger)' : isProcessing ? 'var(--bg-surface-elevated)' : '',
              width: '80px', height: '80px',
              cursor: isProcessing ? 'not-allowed' : 'pointer'
            }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 size={32} className="animate-spin" /> : isRecording ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isRecording ? "Recording... Release to process" : isProcessing ? "AI is processing..." : "Hold to record"}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '40px' }}>
        {/* Spending Trend Chart */}
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} /> Spending Trend
            </h2>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
              <button onClick={() => setTimeRange('week')} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: timeRange === 'week' ? 'rgba(255,255,255,0.1)' : 'transparent', color: timeRange === 'week' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', border: 'none' }}>7 Days</button>
              <button onClick={() => setTimeRange('month')} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: timeRange === 'month' ? 'rgba(255,255,255,0.1)' : 'transparent', color: timeRange === 'month' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', border: 'none' }}>30 Days</button>
              <button onClick={() => setTimeRange('year')} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: timeRange === 'year' ? 'rgba(255,255,255,0.1)' : 'transparent', color: timeRange === 'year' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', border: 'none' }}>1 Year</button>
            </div>
          </div>
          <div className="glass-panel" style={{ height: '300px', padding: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: 'var(--danger)' }} />
                <Area type="monotone" dataKey="Expense" stroke="var(--danger)" fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Donut */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChartIcon size={20} /> Breakdown
          </h2>
          <div className="glass-panel" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No expenses to chart</p>
            )}
          </div>
        </div>
      </div>

      {/* Budgets Section */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={20} /> Budgets
          </h2>
          <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
            {showBudgetForm ? 'Cancel' : 'Set Budget'}
          </button>
        </div>

        {showBudgetForm && (
          <form onSubmit={saveBudget} className="glass-panel" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Category</label>
              <input type="text" className="input-field" required value={budgetForm.category} onChange={e => setBudgetForm({...budgetForm, category: e.target.value})} placeholder="e.g. Food" />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Monthly Limit (₹)</label>
              <input type="number" className="input-field" required value={budgetForm.limit} onChange={e => setBudgetForm({...budgetForm, limit: e.target.value})} placeholder="5000" />
            </div>
            <button type="submit" className="btn-primary" style={{ height: '48px', padding: '0 24px', flex: '1 1 100px' }}>Save</button>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {budgets.map(budget => {
            const spent = categoryDataMap.get(budget.category) || 0;
            const percentage = Math.min((spent / budget.limit) * 100, 100);
            const isOver = spent > budget.limit;
            return (
              <div key={budget.id} className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '500' }}>{budget.category}</span>
                  <span style={{ color: isOver ? 'var(--danger)' : 'var(--text-secondary)' }}>₹{spent} / ₹{budget.limit}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: isOver ? 'var(--danger)' : 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChartIcon size={24} /> Recent Transactions
        </h2>
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>Category</th>
                <th style={{ padding: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>Description</th>
                <th style={{ padding: '16px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '16px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions yet.</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '16px' }}>
                      {editingId === t.id ? (
                        <select className="input-field" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} style={{ padding: '4px' }}>
                          <option value="EXPENSE">EXPENSE</option>
                          <option value="REVENUE">REVENUE</option>
                        </select>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: t.type === 'REVENUE' ? 'var(--success-glow)' : 'var(--danger-glow)', color: t.type === 'REVENUE' ? 'var(--success)' : 'var(--danger)' }}>
                          {t.type}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px', fontWeight: '500' }}>
                      {editingId === t.id ? <input className="input-field" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={{ padding: '4px' }} /> : t.category}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {editingId === t.id ? <input className="input-field" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} style={{ padding: '4px' }} /> : t.description || '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                      {editingId === t.id ? (
                        <input className="input-field" type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} style={{ padding: '4px', width: '80px', textAlign: 'right' }} />
                      ) : (
                        `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      {editingId === t.id ? (
                        <button onClick={saveEdit} className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Save</button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                          <button onClick={() => deleteTransaction(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
