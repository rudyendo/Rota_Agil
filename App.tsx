
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Upload, 
  Navigation, 
  X,
  Loader2,
  Trash2,
  FileText,
  Save
} from 'lucide-react';
import { Customer } from './types';
import { initialCustomers } from './initialData';
import CustomerCard from './components/CustomerCard';
import { parseFileToCustomers, parseRawTextToCustomers } from './services/geminiService';

const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [isPreparingRoute, setIsPreparingRoute] = useState(false);
  const [routeStatus, setRouteStatus] = useState<string>('');
  
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cosmo_customers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setCustomers(parsed);
          return;
        }
      } catch (e) {}
    }
    setCustomers(initialCustomers);
  }, []);

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
      (c.neighborhood && c.neighborhood.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer({ ...customer });
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
    if (!editingCustomer?.name || !editingCustomer?.address) return;

    setCustomers(prev => {
      const updated = [...prev];
      if (editingCustomer.id) {
        const idx = updated.findIndex(c => c.id === editingCustomer.id);
        if (idx >= 0) updated[idx] = editingCustomer as Customer;
      } else {
        const newCust: Customer = {
          ...(editingCustomer as Customer),
          id: Math.random().toString(36).substr(2, 9),
          phone: editingCustomer.phone || [],
          secondaryAddresses: editingCustomer.secondaryAddresses || []
        };
        updated.unshift(newCust);
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
          c.name.toLowerCase().trim() === newCust.name.toLowerCase().trim()
        );
        if (index >= 0) {
          const existing = { ...updated[index] };
          if (newCust.address && existing.address !== newCust.address) {
            if (!existing.secondaryAddresses.includes(newCust.address)) {
              existing.secondaryAddresses.push(newCust.address);
            }
          }
          if (newCust.phone && !existing.phone.includes(newCust.phone)) {
            existing.phone.push(newCust.phone);
          }
          updated[index] = existing;
        } else {
          updated.push({
            id: Math.random().toString(36).substr(2, 9),
            name: newCust.name,
            address: newCust.address || '',
            neighborhood: newCust.neighborhood || '',
            city: newCust.city || '',
            state: newCust.state || 'RN',
            phone: newCust.phone ? [newCust.phone] : [],
            secondaryAddresses: [],
            status: newCust.status || 'Ativo'
          });
        }
      });
      return updated;
    });
  };

  const handleError = (error: any) => {
    console.error("Erro na aplicação:", error);
    if (error.message === "API_KEY_NOT_FOUND") {
      alert("A variável de ambiente API_KEY não foi encontrada. Verifique as configurações no Vercel.");
    } else {
      alert("Houve um erro na comunicação com a IA para importação de dados.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setImportStatus('IA lendo arquivo...');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result?.toString().split(',')[1];
        if (base64) {
          try {
            const data = await parseFileToCustomers(base64, file.type);
            processExtractedData(data);
            setIsImportModalOpen(false);
          } catch (err) {
            handleError(err);
          }
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsProcessing(false);
      handleError(error);
    }
  };

  const handleTextImport = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    setImportStatus('IA Processando...');
    try {
      const data = await parseRawTextToCustomers(importText);
      processExtractedData(data);
      setIsImportModalOpen(false);
      setImportText('');
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(`${position.coords.latitude},${position.coords.longitude}`);
        },
        () => resolve(""),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  const handleViewOnMap = async () => {
    if (selectedIds.size === 0) return;
    setIsPreparingRoute(true);
    setRouteStatus('GPS Localizando...');
    try {
      const currentPos = await getCurrentLocation();
      const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
      const addressStrings = selectedCustomers.map(c => 
        `${c.address}, ${c.neighborhood || ''}, ${c.city || ''}`
      );
      
      // Monta a rota diretamente sem processamento de IA
      const allPoints = currentPos ? [currentPos, ...addressStrings] : addressStrings;
      const routePath = allPoints
        .map(addr => encodeURIComponent(addr.trim()))
        .join('/');
      
      window.open(`https://www.google.com/maps/dir/${routePath}`, '_blank');
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar a rota no mapa.");
    } finally {
      setIsPreparingRoute(false);
      setRouteStatus('');
    }
  };

  const clearAllData = () => {
    if (confirm('Deseja apagar todos os clientes salvos localmente?')) {
      setCustomers([]);
      localStorage.removeItem('cosmo_customers');
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto shadow-xl relative overflow-x-hidden">
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-pink-600 p-2 rounded-xl text-white shadow-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-none">Rota Ágil</h1>
              <p className="text-[10px] text-pink-600 font-bold uppercase mt-1">Vendas Externas</p>
            </div>
          </div>
          <button onClick={clearAllData} title="Limpar Tudo" className="p-2 text-slate-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou endereço..."
            className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-pink-500 outline-none text-sm shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 p-4 pb-32 overflow-y-auto no-scrollbar">
        <div className="mb-4 px-1 flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {selectedIds.size > 0 ? `${selectedIds.size} selecionados` : `${filteredCustomers.length} clientes cadastrados`}
          </span>
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-pink-600 px-3 py-1 bg-pink-50 rounded-full active:scale-95 transition-all">Desmarcar Todos</button>
          )}
        </div>

        <div className="space-y-1">
          {filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Users className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-medium">Nenhum cliente encontrado</p>
            </div>
          ) : (
            filteredCustomers.map(customer => (
              <CustomerCard 
                key={customer.id} 
                customer={customer}
                isSelected={selectedIds.has(customer.id)}
                onSelect={toggleSelect}
                onEdit={handleEdit}
              />
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 max-w-lg mx-auto bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent">
        <div className="bg-white border border-slate-100 shadow-2xl rounded-[2rem] p-3 flex items-center gap-3">
          {selectedIds.size > 0 ? (
            <button 
              onClick={handleViewOnMap}
              disabled={isPreparingRoute}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {isPreparingRoute ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
                  <span className="text-xs uppercase font-black">{routeStatus}</span>
                </div>
              ) : (
                <><Navigation className="w-5 h-5 text-pink-500" /><span>VER NO MAPA</span></>
              )}
            </button>
          ) : (
            <>
              <button onClick={() => setIsImportModalOpen(true)} className="flex-1 h-14 bg-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Upload className="w-5 h-5" />
                <span>Importar</span>
              </button>
              <button onClick={handleOpenNewManual} className="flex-[1.5] h-14 bg-pink-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-pink-200">
                <Plus className="w-6 h-6" />
                <span>Novo Cliente</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Importar</h2>
              {!isProcessing && <X className="w-6 h-6 text-slate-300 cursor-pointer" onClick={() => setIsImportModalOpen(false)} />}
            </div>
            
            <div className="space-y-6">
              <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-2 border-dashed ${isProcessing ? 'border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-pink-500'} rounded-[2rem] p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-95`}>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isProcessing} />
                <div className={`p-4 rounded-2xl ${isProcessing ? 'bg-slate-200 text-slate-400' : 'bg-pink-100 text-pink-600'}`}>
                  {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8" />}
                </div>
                <p className="font-bold text-slate-700 text-center">{isProcessing ? importStatus : 'Foto ou PDF da Lista'}</p>
              </div>

              <div className="space-y-3">
                <textarea className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm resize-none font-medium" placeholder="Ou cole a lista de contatos..." value={importText} onChange={(e) => setImportText(e.target.value)} disabled={isProcessing} />
                <button onClick={handleTextImport} disabled={isProcessing || !importText.trim()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black disabled:opacity-30 active:scale-95 transition-all">
                  {isProcessing ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : 'PROCESSAR COM IA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManualModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <form onSubmit={saveCustomer} className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6 overflow-hidden max-h-[90vh] animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingCustomer.id ? 'Editar' : 'Novo Cliente'}</h2>
              <X className="w-6 h-6 text-slate-300 cursor-pointer" onClick={() => setIsManualModalOpen(false)} />
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar pb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                <input required className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium" value={editingCustomer.name || ''} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
                <input required className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium" value={editingCustomer.address || ''} onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                  <input className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium" value={editingCustomer.neighborhood || ''} onChange={e => setEditingCustomer({...editingCustomer, neighborhood: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium" value={editingCustomer.phone?.[0] || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: [e.target.value]})} />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full py-5 bg-pink-600 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 active:bg-pink-700 shadow-xl shadow-pink-100 transition-all">
              <Save className="w-5 h-5" />
              <span>SALVAR CLIENTE</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
