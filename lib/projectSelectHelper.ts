export interface ProjectOption {
    id: string;
    nombre: string;
    codigoProyecto?: string;
    estado?: string;
    updatedAt?: string | Date;
    [key: string]: any;
}

export function filterOperatorProjects(projects: any[]) {
    if (!projects || !Array.isArray(projects)) return [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Operator-visible states: activo, en_riesgo, atrasado (cancan skip 'por_hacer', 'planificado', 'cancelado')
    const activeStates = ['activo', 'en_riesgo', 'atrasado'];

    return projects.filter(p => {
        if (!p) return false;
        
        // Always include currently active states
        if (activeStates.includes(p.estado)) return true;

        // Include recently finished projects (within last 24 hours) as an "allow-out" window
        if (p.estado === 'finalizado' && p.updatedAt) {
            const upDate = new Date(p.updatedAt);
            if (upDate > oneDayAgo) return true;
        }

        return false;
    });
}

export function getProjectOptions(projects: ProjectOption[], recentIds: string[]) {
    // Basic safety check for inputs
    if (!projects || !Array.isArray(projects)) return [];
    const safeProjects = projects.filter(Boolean);
    if (safeProjects.length === 0) return [];
    
    // Sort recent projects by the order in recentIds
    const recent = (recentIds || [])
        .map(id => safeProjects.find(p => p?.id === id))
        .filter(Boolean) as ProjectOption[];
        
    const recentSet = new Set(recent.map(p => p?.id).filter(Boolean));
    
    const others = safeProjects
        .filter(p => p?.id && !recentSet.has(p.id))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        
    const options = [];
    if (recent.length > 0) {
        options.push(...recent.map(p => ({
            id: p.id,
            label: p.codigoProyecto ? `${p.codigoProyecto} | ${p.nombre}` : p.nombre,
            group: 'Proyectos recientes'
        })));
    }
    
    if (others.length > 0) {
        const groupLabel = recent.length > 0 ? 'Todos los proyectos' : undefined;
        options.push(...others.map(p => ({
            id: p.id,
            label: p.codigoProyecto ? `${p.codigoProyecto} | ${p.nombre}` : p.nombre,
            group: groupLabel
        })));
    }
    
    return options;
}
