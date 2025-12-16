import React from 'react';
import { MessageCircle, BookOpen } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';

interface SupportViewProps {
  t: any;
}

export const SupportView: React.FC<SupportViewProps> = ({ t }) => {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
       {/* Channels Section */}
       <section>
         <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-blue-500"/> {t.contact}</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SOCIAL_LINKS.map(link => (
              <a key={link.name} href={link.url} target="_blank" rel="noreferrer" 
                 className={`relative overflow-hidden ${link.color} text-white p-8 rounded-2xl flex items-center justify-between hover:scale-[1.02] transition-transform shadow-lg group h-40`}>
                 <div className="z-10">
                    <h3 className="text-2xl font-bold mb-2">{link.name}</h3>
                    <span className="text-white/90 text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Connect Now &rarr;</span>
                 </div>
                 <div className="absolute right-[-20px] bottom-[-20px] opacity-20 rotate-12 transform scale-150 font-bold text-9xl pointer-events-none">
                    {link.icon}
                 </div>
              </a>
            ))}
         </div>
       </section>

       {/* Documentation Section */}
       <section className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-purple-500"/> {t.docs}</h2>
          <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <p>{t.docsWelcome}</p>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-4">{t.docsGettingStarted}</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t.docsGettingStarted1}</li>
              <li>{t.docsGettingStarted2}</li>
              <li>{t.docsGettingStarted3}</li>
            </ul>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-4">{t.docsTroubleshooting}</h3>
            <p>{t.docsTroubleshooting1}</p>
          </div>
       </section>
    </div>
  );
};