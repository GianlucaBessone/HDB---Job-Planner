"use client";

import React, { useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
    value: string; // ISO string format YYYY-MM-DD
    onChange: (date: string) => void;
    label?: string;
    placeholder?: string;
}

export function DatePicker({ value, onChange, label, placeholder = 'Seleccionar fecha...' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => value ? parseISO(value) : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? parseISO(value) : null;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const onDateClick = (day: Date) => {
        onChange(format(day, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-3">
                <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Start on Monday

        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    {format(addDays(startDate, i), 'EEEEEE', { locale: es })}
                </div>
            );
        }
        return <div className="grid grid-cols-7 gap-1">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);

                days.push(
                    <button
                        type="button"
                        key={day.toString()}
                        onClick={() => onDateClick(cloneDay)}
                        className={`w-8.5 h-8.5 md:w-9 md:h-9 flex items-center justify-center rounded-full text-xs md:text-sm font-bold transition-all mx-auto
                            ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600 font-medium' : ''}
                            ${isSelected 
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                                : isCurrentMonth 
                                    ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }
                        `}
                    >
                        {formattedDate}
                    </button>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7 gap-1 mb-1" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };

    const calendarContent = (
        <div className="p-4 md:p-5">
            <div className="md:hidden flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Seleccionar fecha</h3>
                <button type="button" onClick={() => setIsOpen(false)} className="p-1.5 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            {renderHeader()}
            {renderDays()}
            {renderCells()}
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
                <CalendarIcon className={`w-5 h-5 flex-shrink-0 ${value ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className={`font-bold flex-1 truncate ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
                    {value ? format(parseISO(value), 'd \'de\' MMMM, yyyy', { locale: es }) : placeholder}
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
                        
                        {calendarContent}
                    </div>
                </>
            )}
        </div>
    );
}
