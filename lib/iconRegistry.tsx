import {
    Home, MapPin, ClipboardList, Clock, Timer,
    LayoutDashboard, Calendar, LayoutGrid, FileSignature,
    PackageSearch, Package, Users, Landmark, ShieldCheck,
    ShieldAlert, History, Settings, Wrench, FileCheck,
    BookOpen, Sparkles, Bell, Lightbulb, LifeBuoy, ListTodo,
    Target, Gauge, Receipt, FileBadge, HardHat, Shield,
    ShoppingCart, Boxes, Warehouse, CreditCard, Plane, Luggage, FileSearch,
    Calculator, Wallet, Database, Table, Briefcase, FileText, Fingerprint, IdCard,
    type LucideIcon
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
    Home,
    MapPin,
    ClipboardList,
    Clock,
    Timer,
    LayoutDashboard,
    Calendar,
    LayoutGrid,
    FileSignature,
    PackageSearch,
    Package,
    Users,
    Landmark,
    ShieldCheck,
    ShieldAlert,
    History,
    Settings,
    Wrench,
    FileCheck,
    BookOpen,
    Sparkles,
    Bell,
    Lightbulb,
    LifeBuoy,
    ListTodo,
    Target,
    Gauge,
    Receipt,
    FileBadge,
    HardHat,
    Shield,
    ShoppingCart,
    Boxes,
    Warehouse,
    CreditCard,
    Plane,
    Luggage,
    FileSearch,
    Calculator,
    Wallet,
    Database,
    Table,
    Briefcase,
    FileText,
    Fingerprint,
    IdCard,
};

export function getIcon(name: string): LucideIcon {
    return ICON_MAP[name] || ClipboardList;
}

export function renderIcon(name: string, className?: string) {
    const Icon = getIcon(name);
    return <Icon className={className || 'w-4 h-4'} />;
}
