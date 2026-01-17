
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Map as MapIcon, 
  Plus, 
  Search, 
  Upload, 
  Navigation, 
  X,
  Loader2,
  Trash2,
  FileText,
  Check,
  Save,
  UserPlus
} from 'lucide-react';
import { Customer } from './types';
import { initialCustomers } from './initialData';
import CustomerCard from './components/CustomerCard';
import { parseFileToCustomers, parseRawTextToCustomers, optimizeRouteOrder } from './services/geminiService';

const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modais
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  
  // Estados de Processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Estado de Edição/Cadastro Manual
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar dados iniciais ou do LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('cosmo_customers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setCustomers(parsed);
          return;
        }
      } catch (e) {
        console.error("Falha ao carregar storage", e);
      }
    }
    setCustomers(initialCustomers);
  }, []);

  // Salvar no LocalStorage
  useEffect(() => {
    if (customers.length > 0) {
      localStorage.setItem('cosmo_customers', JSON.stringify(customers));
    }
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.address && c.address.toLowerCase().includes(term)) ||
      c.phone.some(p => p.includes(term)) ||
      (c.neighborhood && c.neighborhood.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsManualModalOpen(true);
  };

  const handleOpenNewManual = () => {
    setEditingCustomer({
      name: '',
      address: '',
      neighborhood: '',
      city: '',
      state: 'RN',
      phone: [''],
      secondaryAddresses: [],
      status: 'Ativo'
    });
    setIsManualModalOpen(true);
  };

  const saveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer?.name || !editingCustomer?.address) {
      alert("Nome e Endereço são obrigatórios");
      return;
    }

    setCustomers(prev => {
      const updated = [...prev];
      if (editingCustomer.id) {
        // Editando existente
        const idx = updated.findIndex(c => c.id === editingCustomer.id);
        if (idx >= 0) updated[idx] = editingCustomer as Customer;
      } else {
        // Novo manual
        updated.unshift({
          ...(editingCustomer as Customer),
          id: Math.random().toString(36).substr(2, 9)
        });
      }
      return updated;
    });

    setIsManualModalOpen(false);
    setEditingCustomer(null);
  };

  const processExtractedData = (data: any[]) => {
    if (!data || !Array.isArray(data)) return;

    setCustomers(prev => {
      const updated = [...prev];
      data.forEach((newCust: any) => {
        if (!newCust.name) return;

        const index = updated.findIndex(c => 
          c.name.toLowerCase().trim() === newCust.name.toLowerCase().trim() || 
          (newCust.phone && c.phone.some(p => p.replace(/\D/g, '') === newCust.phone.replace(/\D/g, '')))
        );

        if (index >= 0) {
          const existing = { ...updated[index] };
          if (newCust.address && existing.address.toLowerCase().trim() !== newCust.address.toLowerCase().trim()) {
            if (!existing.secondaryAddresses.some(addr => addr.toLowerCase().trim() === newCust.address.toLowerCase().trim())) {
              existing.secondaryAddresses = [...existing.secondaryAddresses, newCust.address];
            }
          }
          if (newCust.phone) {
            const cleanNew = newCust.phone.replace(/\D/g, '');
            if (!existing.phone.some(p => p.replace(/\D/g, '') === cleanNew)) {
              existing.phone = [...existing.phone, newCust.phone];
            }
          }
          updated[index] = existing;
        } else {
          updated.push({
            id: Math.random().toString(36).substr(2, 9),
            name: newCust.name,
            address: newCust.address || 'Endereço não informado',
            neighborhood: newCust.neighborhood || '',
            city: newCust.city || '',
            state: newCust.state || '',
            phone: newCust.phone ? [newCust.phone] : [],
            secondaryAddresses: [],
            status: newCust.status || 'Ativo'
          });
        }
      });
      return updated;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setImportStatus('Preparando arquivo...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          setImportStatus('IA analisando...');
          const base64 = (reader.result as string).split(',')[1];
          const data = await parseFileToCustomers(base64, file.type);
          if (data && data.length > 0) {
            setImportStatus(`Adicionando ${data.length}...`);
            processExtractedData(data);
            setIsImportModalOpen(false);
          } else {
            alert('Não detectamos clientes no arquivo.');
          }
        } catch (err) {
          alert('Erro no processamento IA.');
        } finally {
          setIsProcessing(false);
          setImportStatus('');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  const handleTextImport = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    setImportStatus('Processando...');
    try {
      const data = await parseRawTextToCustomers(importText);
      processExtractedData(data);
      setImportText('');
      setIsImportModalOpen(false);
    } catch (error) {
      alert('Erro ao processar texto.');
    } finally {
      setIsProcessing(false);
      setImportStatus('');
    }
  };

  const openRoute = async () => {
    if (selectedIds.size === 0) return;
    setIsOptimizing(true);
    const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
    const addresses = selectedCustomers.map(c => `${c.address}, ${c.neighborhood || ''}, ${c.city || ''}`);
    try {
      const orderedAddresses = await optimizeRouteOrder(addresses);
      const waypoints = orderedAddresses.slice(0, -1).map(w => encodeURIComponent(w)).join('/');
      const destination = encodeURIComponent(orderedAddresses[orderedAddresses.length - 1]);
      const url = `https://www.google.com/maps/dir/current+location/${waypoints}/${destination}`;
      window.open(url, '_blank');
    } catch (err) {
      const query = selectedCustomers.map(c => encodeURIComponent(c.address)).join('/');
      window.open(`https://www.google.com/maps/dir/current+location/${query}`, '_blank');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 max-w-md mx-auto relative shadow-2xl overflow-hidden h-screen">
      <header className="shrink-0 bg-white border-b px-4 py-4 flex flex-col gap-3 shadow-sm z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-pink-100">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-none">Rota Ágil</h1>
              <p className="text-[10px] text-pink-500 font-bold uppercase tracking-wider mt-1">Consultor de Beleza</p>
            </div>
          </div>
          <button 
            onClick={() => {if(confirm('Isso apagará todos os seus clientes salvos. Continuar?')) setCustomers([])}} 
            className="p-2 text-slate-300 hover:text-red-500 active:scale-90 transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Nome, bairro ou telefone..."
            className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-pink-500 text-sm outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto no-scrollbar pb-36">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="bg-white p-8 rounded-[2rem] mb-6 shadow-sm border border-slate-100">
              <Users className="w-16 h-16 text-slate-100" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Nenhum cliente</h2>
            <p className="text-slate-400 text-sm mt-2">Toque em <Upload className="inline w-3 h-3"/> para importar ou <Plus className="inline w-3 h-3"/> para cadastrar.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center mb-4 px-1">
              <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                {selectedIds.size > 0 ? `${selectedIds.size} selecionados` : `${filteredCustomers.length} clientes cadastrados`}
              </span>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full">Limpar</button>
              )}
            </div>
            {filteredCustomers.map(customer => (
              <CustomerCard 
                key={customer.id} 
                customer={customer} 
                isSelected={selectedIds.has(customer.id)}
                onSelect={toggleSelect}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Bar */}
      <div className="absolute bottom-6 left-0 right-0 px-4 flex justify-between items-center pointer-events-none z-20">
        <button 
          onClick={() => setIsImportModalOpen(true)}
          title="Importação em Massa"
          className="w-14 h-14 bg-white shadow-2xl border border-slate-100 rounded-2xl flex items-center justify-center text-slate-600 active:scale-90 transition-all pointer-events-auto"
        >
          <Upload className="w-6 h-6" />
        </button>

        {selectedIds.size > 0 ? (
          <button 
            onClick={openRoute}
            disabled={isOptimizing}
            className="flex-1 mx-4 bg-slate-900 text-white font-black h-14 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto disabled:opacity-50"
          >
            {isOptimizing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Navigation className="w-5 h-5 text-pink-500" /><span>ROTA OTIMIZADA</span></>}
          </button>
        ) : (
          <div className="flex-1"></div>
        )}

        <button 
          onClick={handleOpenNewManual}
          title="Novo Cadastro Manual"
          className="w-14 h-14 bg-pink-500 text-white rounded-2xl shadow-2xl shadow-pink-200 flex items-center justify-center active:scale-90 transition-all pointer-events-auto ml-4"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Modal: Importação Automática */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6 overflow-hidden max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">Importar</h2>
              <button onClick={() => !isProcessing && setIsImportModalOpen(false)} className="p-2"><X className="w-6 h-6 text-slate-300" /></button>
            </div>
            
            <div className="space-y-6 overflow-y-auto pr-1 no-scrollbar pb-4">
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`group border-2 border-dashed ${isProcessing ? 'border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-pink-500 hover:bg-pink-50'} rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all active:scale-95`}
              >
                <div className={`w-16 h-16 ${isProcessing ? 'bg-slate-200' : 'bg-pink-100'} rounded-[1.5rem] flex items-center justify-center ${isProcessing ? 'text-slate-400' : 'text-pink-600'} group-hover:scale-110`}>
                  {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8" />}
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-700">{isProcessing ? importStatus : 'Selecionar Documento'}</p>
                  <p className="text-xs text-slate-400 mt-1">PDF ou Foto da Lista</p>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} disabled={isProcessing} />
              </div>

              <div className="space-y-3">
                <textarea 
                  className="w-full h-24 p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-2 focus:ring-pink-500 outline-none text-sm transition-all resize-none font-medium"
                  placeholder="Ou cole o texto aqui..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  disabled={isProcessing}
                ></textarea>
                <button 
                  onClick={handleTextImport}
                  disabled={isProcessing || !importText.trim()}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black active:bg-slate-800 disabled:opacity-30 transition-all"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : 'PROCESSAR TEXTO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastro Manual / Edição */}
      {isManualModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10 duration-300">
          <form onSubmit={saveCustomer} className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6 overflow-hidden max-h-[90vh]">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800">{editingCustomer.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                <p className="text-[10px] text-pink-500 font-bold uppercase tracking-widest mt-1">Cadastro Manual</p>
              </div>
              <button type="button" onClick={() => setIsManualModalOpen(false)} className="p-2"><X className="w-6 h-6 text-slate-300" /></button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar pb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                <input 
                  autoFocus
                  required
                  className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                  placeholder="Nome do cliente"
                  value={editingCustomer.name}
                  onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone Principal</label>
                <input 
                  className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                  placeholder="(00) 00000-0000"
                  value={editingCustomer.phone?.[0] || ''}
                  onChange={e => {
                    const phones = [...(editingCustomer.phone || [])];
                    phones[0] = e.target.value;
                    setEditingCustomer({...editingCustomer, phone: phones});
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço Principal *</label>
                <input 
                  required
                  className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                  placeholder="Rua, Número..."
                  value={editingCustomer.address}
                  onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                  <input 
                    className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                    placeholder="Bairro"
                    value={editingCustomer.neighborhood}
                    onChange={e => setEditingCustomer({...editingCustomer, neighborhood: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                  <input 
                    className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
                    placeholder="Cidade"
                    value={editingCustomer.city}
                    onChange={e => setEditingCustomer({...editingCustomer, city: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                <select 
                  className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium appearance-none"
                  value={editingCustomer.status}
                  onChange={e => setEditingCustomer({...editingCustomer, status: e.target.value})}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Pendente">Pendente</option>
                </select>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-5 bg-pink-600 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 active:bg-pink-700 shadow-xl shadow-pink-100 transition-all"
            >
              <Save className="w-5 h-5" />
              <span>{editingCustomer.id ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CLIENTE'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
