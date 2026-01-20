
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
  Save,
  CheckCircle,
  MapPin,
  Settings
} from 'lucide-react';
import { Customer } from './types';
import { initialCustomers } from './initialData';
import CustomerCard from './components/CustomerCard';
import { parseFileToCustomers, parseRawTextToCustomers } from './services/geminiService';
import { optimizeRouteRobo } from './services/routeService';

const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mapProvider, setMapProvider] = useState<'google' | 'waze'>('google');
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [isPreparingRoute, setIsPreparingRoute] = useState(false);
  
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cosmo_customers');
    const savedProvider = localStorage.getItem('cosmo_map_provider') as 'google' | 'waze';
    if (savedProvider) setMapProvider(savedProvider);

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
    localStorage.setItem('cosmo_map_provider', mapProvider);
  }, [customers, mapProvider]);

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
          updated[index] = { ...updated[index], ...newCust };
        } else {
          updated.push({
            id: Math.random().toString(36).substr(2, 9),
            ...newCust,
            phone: newCust.phone ? [newCust.phone] : [],
            secondaryAddresses: []
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
    setImportStatus('IA Geocodificando...');
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
            console.error(err);
            alert("Erro na leitura.");
          }
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsProcessing(false);
      console.error(error);
    }
  };

  const handleTextImport = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    setImportStatus('IA Localizando...');
    try {
      const data = await parseRawTextToCustomers(importText);
      processExtractedData(data);
      setIsImportModalOpen(false);
      setImportText('');
    } catch (error) {
      console.error(error);
      alert("Erro no processamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getCurrentCoords = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 3000 } // Tempo menor para evitar bloqueio no iOS
      );
    });
  };

  const handleViewOnMap = async () => {
    if (selectedIds.size === 0) return;
    setIsPreparingRoute(true);
    
    try {
      const coords = await getCurrentCoords();
      const selectedList = customers.filter(c => selectedIds.has(c.id));
      const optimizedList = optimizeRouteRobo(selectedList, coords?.lat, coords?.lng);

      let finalUrl = '';

      if (mapProvider === 'waze') {
        const firstDest = optimizedList[0];
        const query = encodeURIComponent(`${firstDest.address}, ${firstDest.neighborhood || ''}, ${firstDest.city || ''}`);
        // No iPhone, deep links funcionam melhor com atribuição direta à location
        finalUrl = `https://www.waze.com/ul?q=${query}&navigate=yes`;
      } else {
        const addressStrings = optimizedList.map(c => 
          `${c.address}, ${c.neighborhood || ''}, ${c.city || ''}`
        );
        const startPoint = coords ? `${coords.lat},${coords.lng}` : addressStrings[0];
        const stops = coords ? addressStrings : addressStrings.slice(1);
        const routePath = [startPoint, ...stops]
          .map(addr => encodeURIComponent(addr.trim()))
          .join('/');
        finalUrl = `https://www.google.com/maps/dir/${routePath}`;
      }

      // IMPORTANTE: No iPhone, usar window.location.href em vez de window.open
      // para evitar o bloqueador de pop-ups em funções assíncronas.
      window.location.href = finalUrl;
      
    } catch (error) {
      console.error(error);
      alert("Erro ao abrir o aplicativo de mapas.");
    } finally {
      setIsPreparingRoute(false);
    }
  };

  const clearAllData = () => {
    if (confirm('Apagar tudo?')) {
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
              <h1 className="font-bold text-slate-900 leading-none tracking-tight">Rota Ágil</h1>
              <p className="text-[10px] text-pink-600 font-bold uppercase mt-1 tracking-wider">Vendas Externas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={clearAllData} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
               <Trash2 className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou bairro..."
              className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-pink-500 outline-none text-sm shadow-inner transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
            <button 
              onClick={() => setMapProvider('google')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${mapProvider === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              G. MAPS
            </button>
            <button 
              onClick={() => setMapProvider('waze')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${mapProvider === 'waze' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              WAZE
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-32 overflow-y-auto no-scrollbar">
        <div className="mb-4 px-1 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {selectedIds.size > 0 ? `${selectedIds.size} selecionados` : `${filteredCustomers.length} contatos`}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-pink-600 px-3 py-1 bg-pink-50 rounded-full active:scale-95 transition-all">Limpar Seleção</button>
          )}
        </div>

        <div className="space-y-1">
          {filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-medium">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            filteredCustomers.map(customer => (
              <CustomerCard 
                key={customer.id} 
                customer={customer}
                isSelected={selectedIds.has(customer.id)}
                onSelect={toggleSelect}
                onEdit={handleEdit}
                preferredProvider={mapProvider}
              />
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 max-w-lg mx-auto bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent">
        <div className="bg-white border border-slate-100 shadow-2xl rounded-[2.5rem] p-3 flex items-center gap-3">
          {selectedIds.size > 0 ? (
            <button 
              onClick={handleViewOnMap}
              disabled={isPreparingRoute}
              className="w-full h-16 bg-slate-900 text-white rounded-[1.8rem] font-black flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-slate-200"
            >
              {isPreparingRoute ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
                  <span className="text-xs uppercase font-black">Abrindo App...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>ABRIR {mapProvider === 'google' ? 'G. MAPS' : 'WAZE'}</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button onClick={() => setIsImportModalOpen(true)} className="flex-1 h-16 bg-slate-100 text-slate-700 rounded-[1.8rem] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Upload className="w-5 h-5" />
                <span>Importar</span>
              </button>
              <button onClick={handleOpenNewManual} className="flex-[1.4] h-16 bg-pink-600 text-white rounded-[1.8rem] font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-pink-200">
                <Plus className="w-6 h-6" />
                <span>Novo Cliente</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Importar Lista</h2>
                <p className="text-xs text-slate-400 font-medium">A IA irá organizar os dados para você</p>
              </div>
              {!isProcessing && <X className="w-8 h-8 p-2 bg-slate-50 text-slate-400 rounded-full cursor-pointer" onClick={() => setIsImportModalOpen(false)} />}
            </div>
            
            <div className="space-y-6">
              <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-2 border-dashed ${isProcessing ? 'border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-pink-500'} rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-95`}>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isProcessing} />
                <div className={`p-5 rounded-2xl ${isProcessing ? 'bg-slate-200 text-slate-400' : 'bg-pink-100 text-pink-600'}`}>
                  {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8" />}
                </div>
                <p className="font-bold text-slate-700 text-center">{isProcessing ? importStatus : 'Foto da Lista ou PDF'}</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300"><span className="bg-white px-2">ou texto</span></div>
              </div>

              <div className="space-y-3">
                <textarea className="w-full h-28 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm resize-none font-medium placeholder:text-slate-300" placeholder="Cole os nomes e endereços aqui..." value={importText} onChange={(e) => setImportText(e.target.value)} disabled={isProcessing} />
                <button onClick={handleTextImport} disabled={isProcessing || !importText.trim()} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black disabled:opacity-30 active:scale-95 transition-all shadow-xl shadow-slate-200">
                  {isProcessing ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : 'PROCESSAR COM IA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManualModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <form onSubmit={saveCustomer} className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl flex flex-col gap-6 overflow-hidden max-h-[95vh] animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingCustomer.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <X className="w-8 h-8 p-2 bg-slate-50 text-slate-400 rounded-full cursor-pointer" onClick={() => setIsManualModalOpen(false)} />
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar pb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input required className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold text-slate-700" value={editingCustomer.name || ''} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço (Rua e Número)</label>
                <input required className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold text-slate-700" value={editingCustomer.address || ''} onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                  <input className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold text-slate-700" value={editingCustomer.neighborhood || ''} onChange={e => setEditingCustomer({...editingCustomer, neighborhood: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold text-slate-700" value={editingCustomer.phone?.[0] || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: [e.target.value]})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                <input className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold text-slate-700" value={editingCustomer.city || ''} onChange={e => setEditingCustomer({...editingCustomer, city: e.target.value})} />
              </div>
            </div>

            <button type="submit" className="w-full py-5 bg-pink-600 text-white rounded-[1.8rem] font-black flex items-center justify-center gap-3 active:bg-pink-700 shadow-xl shadow-pink-100 transition-all">
              <Save className="w-5 h-5" />
              <span>SALVAR ALTERAÇÕES</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
