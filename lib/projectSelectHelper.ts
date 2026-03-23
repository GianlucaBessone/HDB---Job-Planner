export interface ProjectOption {
    id: string;
    nombre: string;
    codigoProyecto?: string;
    [key: string]: any;
}

export function getProjectOptions(projects: ProjectOption[], recentIds: string[]) {
    if (!projects || projects.length === 0) return [];
    
    // Sort recent projects by the order in recentIds
    const recent = recentIds
        .map(id => projects.find(p => p.id === id))
        .filter(Boolean) as ProjectOption[];
        
    const recentSet = new Set(recent.map(p => p.id));
    
    const others = projects
        .filter(p => !recentSet.has(p.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
        
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
