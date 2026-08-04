"use client";

import React from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
    value: string; // Format HH:mm
    onChange: (time: string) => void;
    label?: string;
    placeholder?: string;
}

export function TimePicker({ value, onChange, label, placeholder = 'Seleccionar hora...' }: TimePickerProps) {
    return (
        <div className="relative">
            {label && (
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1 mb-2">
                    {label}
                </label>
            )}
            
            <div className="relative">
                <Clock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex-shrink-0 pointer-events-none ${value ? 'text-indigo-500' : 'text-slate-400'}`} />
                <input
                    type="time"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-background text-left flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all h-[52px] font-bold ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 font-medium'}`}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
}
