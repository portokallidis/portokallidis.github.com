// Keep source records intact while using the owner's preferred name in the UI.
export const displayPreferredName = (text: string) => text.replace(/\b(?:Nikolaos(?: Portokallidis)?|N\. Portokallidis)\b/g, 'Nick Portokallidis');
