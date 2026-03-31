import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const GlobalLayout = () => {
  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Subtle Background Glows for Premium Aesthetic */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-100 rounded-full blur-[120px] -z-10 opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-[20%] w-[400px] h-[400px] bg-purple-100 rounded-full blur-[100px] -z-10 opacity-60 pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto w-full p-8 z-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
