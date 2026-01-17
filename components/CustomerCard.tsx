
import React from 'react';
import { Customer } from '../types';
import { Phone, MapPin, CheckCircle2, MessageCircle, Edit2 } from 'lucide-react';

interface CustomerCardProps {
  customer: Customer;
  onSelect?: (id: string) => void;
  onEdit?: (customer: Customer) => void;
  isSelected?: boolean;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onSelect, onEdit, isSelected }) => {
  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  const openMaps = (address: string) => {
    const query = encodeURIComponent(`${address}, ${customer.neighborhood || ''}, ${customer.city || ''}, ${customer.state || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border p-4 mb-3 transition-all ${
        isSelected ? 'border-pink-500 ring-2 ring-pink-100' : 'border-slate-100'
      }`}
      onClick={() => onSelect && onSelect(customer.id)}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-slate-800 text-lg leading-tight uppercase line-clamp-1 flex-1 mr-2">{customer.name}</h3>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(customer); }}
            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-pink-500 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {onSelect && (
            <div 
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected ? 'bg-pink-500 border-pink-500' : 'border-slate-300'
              }`}
            >
              {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-start text-slate-500 text-sm">
          <MapPin className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{customer.address}{customer.neighborhood ? `, ${customer.neighborhood}` : ''}{customer.city ? ` - ${customer.city}` : ''}</span>
        </div>
        {customer.phone.length > 0 && (
          <div className="flex items-center text-slate-500 text-sm">
            <Phone className="w-4 h-4 mr-2 shrink-0" />
            <span>{customer.phone[0]}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={(e) => { e.stopPropagation(); openWhatsApp(customer.phone[0] || ''); }}
          disabled={!customer.phone[0]}
          className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-500 text-white rounded-lg font-medium active:scale-95 transition-transform disabled:opacity-50"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); openMaps(customer.address); }}
          className="flex items-center justify-center gap-2 py-2 px-4 bg-blue-500 text-white rounded-lg font-medium active:scale-95 transition-transform"
        >
          <MapPin className="w-4 h-4" />
          Mapa
        </button>
      </div>
    </div>
  );
};

export default CustomerCard;
