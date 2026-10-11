export const sections: Record<string, string> = {
    overview: 'Overview',
    content: 'Content library',
    import: 'Import content',
    calendar: 'Calendar',
    planner: 'All Pages planner',
    studio: 'Poster studio',
    sources: 'Source library',
    analytics: 'Analytics',
    team: 'Team & activity',
    integrations: 'Integrations',
    settings: 'Brand settings',
};
export function sectionUrl(view: string, workspace = '') {
    const slug = Object.keys(sections).find(key => sections[key] === view) || 'overview';
    return '/' + slug + (workspace ? '?workspace=' + encodeURIComponent(workspace) : '');
}
