export function categorizeMethod(name: string): string {
  if (name.includes('Page')) return 'page';
  if (name.includes('Component')) return 'component';
  if (name.includes('Asset')) return 'asset';
  if (name.includes('Template')) return 'template';
  if (/search/i.test(name)) return 'search';
  if (name.includes('Site') || name.includes('Language') || name.includes('Locale')) return 'site';
  if (name.includes('publish') || name.includes('activate') || name.includes('replicate')) return 'replication';
  if (name.toLowerCase().includes('workflow')) return 'workflow';
  if (name.includes('Node') || name.includes('Children')) return 'legacy';
  return 'utility';
}

export function categorizeMethods(methods: any[]): Record<string, any[]> {
  return methods.reduce((acc: Record<string, any[]>, method: any) => {
    const category = method.category || categorizeMethod(method.name);
    if (!acc[category]) acc[category] = [];
    acc[category].push(method);
    return acc;
  }, {} as Record<string, any[]>);
}
