
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xl">S</div>
          <h1 className="text-xl font-bold tracking-tight">SketchFlow <span className="text-blue-600">AI</span></h1>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-500">
          <a href="#" className="text-slate-900 hover:text-blue-600">Storyboarder</a>
          <a href="#" className="hover:text-blue-600">Projects</a>
          <a href="#" className="hover:text-blue-600">Assets</a>
        </nav>
        <div className="flex items-center gap-4">
          <button className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-200">
            Export Project
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
