"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Clock, X } from 'lucide-react';

interface TimePickerProps {
    value: string; // Format HH:mm
    onChange: (time: string) => void;
    label?: string;
    placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const ITEM_HEIGHT = 48; // Tailwind h-12 = 48px

export function TimePicker({ value, onChange, label, placeholder = 'Seleccionar hora...' }: TimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hourScrollRef = useRef<HTMLDivElement>(null);
    const minuteScrollRef = useRef<HTMLDivElement>(null);

    const [tempHour, setTempHour] = useState('00');
    const [tempMinute, setTempMinute] = useState('00');

    // Parse initial value
    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':');
            setTempHour(h || '00');
            // If the minute is not in the predefined list, snap it to the closest one
            let closestM = '00';
            if (m) {
                const mNum = parseInt(m, 10);
                const closest = MINUTES.reduce((prev, curr) => 
                    Math.abs(parseInt(curr, 10) - mNum) < Math.abs(parseInt(prev, 10) - mNum) ? curr : prev
                );
                closestM = closest;
            }
            setTempMinute(closestM);
        } else {
            setTempHour('08');
            setTempMinute('00');
        }
    }, [value, isOpen]);

    // Handle clicks outside to close and setup wheel events
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        let hEl: HTMLDivElement | null = null;
        let mEl: HTMLDivElement | null = null;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            const target = e.currentTarget as HTMLElement;
            const currentIndex = Math.round(target.scrollTop / ITEM_HEIGHT);
            target.scrollTo({
                top: (currentIndex + delta) * ITEM_HEIGHT,
                behavior: 'smooth'
            });
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            
            // Scroll to current selected values when opened and attach wheel listeners
            setTimeout(() => {
                hEl = hourScrollRef.current;
                mEl = minuteScrollRef.current;

                if (hEl) {
                    const hourIdx = HOURS.indexOf(tempHour);
                    hEl.scrollTop = Math.max(0, hourIdx * ITEM_HEIGHT);
                    hEl.addEventListener('wheel', handleWheel, { passive: false });
                }
                if (mEl) {
                    const minuteIdx = Math.max(0, MINUTES.indexOf(tempMinute));
                    mEl.scrollTop = Math.max(0, minuteIdx * ITEM_HEIGHT);
                    mEl.addEventListener('wheel', handleWheel, { passive: false });
                }
            }, 10);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (hEl) hEl.removeEventListener('wheel', handleWheel);
            if (mEl) mEl.removeEventListener('wheel', handleWheel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        if (HOURS[index]) {
            setTempHour(HOURS[index]);
        }
    };

    const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        if (MINUTES[index]) {
            setTempMinute(MINUTES[index]);
        }
    };

    const handleConfirm = () => {
        onChange(`${tempHour}:${tempMinute}`);
        setIsOpen(false);
    };

    const pickerContent = (
        <div className="p-5 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Seleccionar hora</h3>
                <button type="button" onClick={() => setIsOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center gap-6 relative px-4">
                {/* Selection Highlight Bar */}
                <div className="absolute left-0 right-0 h-[48px] bg-slate-100 dark:bg-slate-800/80 rounded-2xl pointer-events-none top-1/2 -translate-y-1/2" />
                
                {/* Hours Wheel */}
                <div className="relative h-[240px] w-16 overflow-hidden mask-image-fade">
                    <div 
                        ref={hourScrollRef}
                        onScroll={handleHourScroll}
                        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-[96px] pb-[96px]" // padding to allow first and last items to be centered
                    >
                        {HOURS.map(h => (
                            <div key={`h-${h}`} className={`h-[48px] flex items-center justify-center snap-center text-2xl font-bold transition-all duration-150 ${h === tempHour ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 dark:text-slate-500 scale-90'}`}>
                                {h}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-2xl font-black text-slate-300 dark:text-slate-600 pb-1">:</div>

                {/* Minutes Wheel */}
                <div className="relative h-[240px] w-16 overflow-hidden mask-image-fade">
                    <div 
                        ref={minuteScrollRef}
                        onScroll={handleMinuteScroll}
                        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-[96px] pb-[96px]"
                    >
                        {MINUTES.map(m => (
                            <div key={`m-${m}`} className={`h-[48px] flex items-center justify-center snap-center text-2xl font-bold transition-all duration-150 ${m === tempMinute ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 dark:text-slate-500 scale-90'}`}>
                                {m}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 flex-shrink-0">
                <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 active:scale-95 uppercase tracking-widest text-xs"
                >
                    Confirmar Hora
                </button>
            </div>
        </div>
    );

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1 mb-2">
                    {label}
                </label>
            )}
            
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`w-full bg-background text-left flex items-center gap-3 border ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-700'} rounded-2xl py-3.5 px-4 outline-none transition-all h-[52px]`}
            >
                <Clock className={`w-5 h-5 flex-shrink-0 ${value ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className={`font-bold flex-1 truncate ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
                    {value || placeholder}
                </span>
            </button>

            {isOpen && (
                <>
                    {/* Mobile Backdrop */}
                    <div className="fixed inset-0 z-[105] bg-slate-900/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsOpen(false)} />
                    
                    {/* Responsive Modal/Popover */}
                    <div className={`
                        fixed bottom-6 left-4 right-4 max-w-sm mx-auto z-[110] bg-card rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700
                        md:absolute md:bottom-auto md:left-0 md:right-auto md:top-[calc(100%+6px)] md:w-[320px] md:rounded-2xl md:border md:origin-top-left
                        animate-in md:zoom-in-95 slide-in-from-bottom-6 md:slide-in-from-bottom-0 duration-300
                    `}>
                        {/* Drag Handle for Mobile */}
                        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 md:hidden" />
                        
                        {pickerContent}
                    </div>
                </>
            )}
        </div>
    );
}
