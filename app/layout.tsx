import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'OMNI · Prompt Lab',description:'Un prompt, douze cas, un déclic. Le laboratoire de prompt engineering OMNI.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>;}
