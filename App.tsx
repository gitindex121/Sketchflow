
import React, { useState, useEffect, useRef } from 'react';
import { Scene, Project, ChatMessage, ImageSize } from './types';
import { Icons } from './constants';
import * as api from './services/geminiService';
import ChatBot from './components/ChatBot';
import Header from './components/Header';

const LOADING_MESSAGES = [
  "Sharpening the virtual pencils...",
  "Hatching some shadows...",
  "Translating your script to charcoal...",
  "The artist is sketching furiously...",
  "Applying the final graphite touches...",
  "Almost there, just adding some artistic flair..."
];

const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [scriptInput, setScriptInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const checkApiKey = async () => {
    try {
      // @ts-ignore
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    } catch (e) {
      setHasApiKey(false);
    }
  };

  const handleOpenKeyPicker = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setScriptInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleScriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptInput.trim()) return;

    setLoading("Analyzing script and breaking into scenes...");
    try {
      const sceneData = await api.analyzeScript(scriptInput);
      const scenes: Scene[] = sceneData.map((s: any, idx: number) => ({
        id: crypto.randomUUID(),
        order: s.order || idx + 1,
        description: s.description,
        dialogue: s.dialogue,
        storyboardPrompt: s.description,
        isApproved: false,
      }));
      setProject({ title: "My New Animation", script: scriptInput, scenes });
    } catch (err: any) {
      setError(err.message || "Failed to analyze script");
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateStoryboard = async (sceneId: string) => {
    if (!project) return;
    setLoading("Generating sketch storyboard...");
    try {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const imageUrl = await api.generateStoryboardImage(scene.storyboardPrompt || scene.description, imageSize);
      
      const updatedScenes = project.scenes.map(s => 
        s.id === sceneId ? { ...s, storyboardImageUrl: imageUrl } : s
      );
      setProject({ ...project, scenes: updatedScenes });
    } catch (err: any) {
      setError(err.message || "Storyboard generation failed");
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateAllStoryboards = async () => {
    if (!project) return;
    setLoading("Generating all storyboards sequentially...");
    const updatedScenes = [...project.scenes];
    
    try {
      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        if (!scene.storyboardImageUrl) {
          setLoading(`Generating sketch for Scene ${scene.order}...`);
          const imageUrl = await api.generateStoryboardImage(scene.storyboardPrompt || scene.description, imageSize);
          updatedScenes[i] = { ...scene, storyboardImageUrl: imageUrl };
          setProject(prev => prev ? { ...prev, scenes: [...updatedScenes] } : null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Bulk generation failed");
    } finally {
      setLoading(null);
    }
  };

  const handleApproveScene = (sceneId: string) => {
    if (!project) return;
    const updatedScenes = project.scenes.map(s => 
      s.id === sceneId ? { ...s, isApproved: !s.isApproved } : s
    );
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleUpdatePrompt = (sceneId: string, newPrompt: string) => {
    if (!project) return;
    const updatedScenes = project.scenes.map(s => 
      s.id === sceneId ? { ...s, storyboardPrompt: newPrompt } : s
    );
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleGenerateFinalVideo = async (sceneId: string) => {
    if (!project) return;
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.storyboardImageUrl) return;

    setLoading(`Animating scene ${scene.order}... This will take about a minute.`);
    try {
      const videoUrlPromise = api.generateSceneVideo(scene.storyboardPrompt || scene.description, scene.storyboardImageUrl);
      const audioUrlPromise = api.generateDialogueSpeech(scene.dialogue);
      
      const [videoUrl, audioUrl] = await Promise.all([videoUrlPromise, audioUrlPromise]);
      
      const updatedScenes = project.scenes.map(s => 
        s.id === sceneId ? { ...s, videoUrl, audioUrl } : s
      );
      setProject({ ...project, scenes: updatedScenes });
    } catch (err: any) {
      if (err.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Session expired. Please re-select your key.");
      } else {
        setError(err.message || "Animation generation failed");
      }
    } finally {
      setLoading(null);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-slate-900">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-3xl font-black">S</div>
          <h1 className="text-3xl font-bold mb-4 sketch-font">SketchFlow AI</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Turn your scripts into rough-sketch animations. To start generating, please select your paid Gemini API key.
          </p>
          <button
            onClick={handleOpenKeyPicker}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            Connect Gemini API
          </button>
          <p className="mt-6 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Project billing required: <a href="https://ai.google.dev/gemini-api/docs/billing" className="underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">Details</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 pencil-bg">
      <Header />

      <main className="container mx-auto px-4 mt-8 max-w-6xl">
        {!project ? (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Icons.Video className="w-8 h-8 text-blue-600" />
                New Animation Project
              </h2>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 border-b-2 border-dashed border-slate-300 hover:border-slate-900 transition"
              >
                Upload script file (.txt)
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".txt" 
                onChange={handleFileUpload} 
              />
            </div>
            <form onSubmit={handleScriptSubmit}>
              <textarea
                value={scriptInput}
                onChange={(e) => setScriptInput(e.target.value)}
                placeholder="INT. COFFEE SHOP - DAY&#10;&#10;A character sits alone, sketching in a notebook. Suddenly, the sketches start to move...&#10;&#10;CHARACTER&#10;What in the world?"
                className="w-full h-64 p-6 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all mb-6 font-mono text-sm resize-none bg-slate-50"
              />
              <button
                type="submit"
                className="w-full bg-slate-900 text-white px-8 py-4 rounded-xl hover:bg-slate-800 flex items-center justify-center gap-3 font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                disabled={!!loading || !scriptInput.trim()}
              >
                {loading ? 'Analyzing...' : 'Generate Storyboard Scenes'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-lg border border-slate-200 gap-4">
              <div>
                <h2 className="text-3xl font-bold sketch-font text-slate-900">{project.title}</h2>
                <div className="flex gap-4 mt-1">
                  <span className="text-slate-400 text-xs uppercase tracking-widest font-bold">{project.scenes.length} Scenes Identified</span>
                  <button onClick={() => setProject(null)} className="text-xs text-red-400 font-bold uppercase tracking-widest hover:text-red-600 transition">Reset Project</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border">
                  <span className="text-xs font-bold text-slate-500 uppercase">Quality</span>
                  <select 
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value as ImageSize)}
                    className="bg-transparent text-sm font-bold outline-none"
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <button 
                  onClick={handleGenerateAllStoryboards}
                  disabled={!!loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Icons.Image className="w-4 h-4" />
                  Generate All Sketches
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
              {project.scenes.map((scene) => (
                <section key={scene.id} className={`group relative transition-all ${scene.isApproved ? 'scale-100' : 'opacity-90 grayscale-[0.5]'}`}>
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-blue-400 transition-colors rounded-full" />
                  
                  <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-md transform rotate-3">
                          {scene.order}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Scene {scene.order}</h3>
                          <p className="text-slate-400 text-xs font-mono truncate max-w-xs">{scene.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleApproveScene(scene.id)}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
                          scene.isApproved 
                            ? 'bg-green-500 text-white ring-4 ring-green-100' 
                            : 'bg-white border border-slate-200 text-slate-400 hover:border-green-500 hover:text-green-500'
                        }`}
                      >
                        <Icons.Check className="w-5 h-5" />
                        {scene.isApproved ? 'Ready for Production' : 'Approve for Animation'}
                      </button>
                    </div>

                    <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                      <div className="lg:col-span-5 space-y-8">
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Narrative & Action</h4>
                          <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                            {scene.description}
                          </p>
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dialogue</h4>
                          <div className="p-5 bg-white rounded-2xl text-slate-900 sketch-font text-2xl border-l-8 border-slate-900 shadow-sm">
                            "{scene.dialogue}"
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Visual Prompt</h4>
                          <textarea
                            value={scene.storyboardPrompt}
                            onChange={(e) => handleUpdatePrompt(scene.id, e.target.value)}
                            className="w-full p-4 text-sm border-2 border-slate-100 rounded-2xl bg-white focus:border-slate-900 transition-colors h-24 resize-none"
                            placeholder="Fine-tune the visual look..."
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleGenerateStoryboard(scene.id)}
                              disabled={!!loading}
                              className="flex-1 bg-white border-2 border-slate-900 text-slate-900 px-4 py-3 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2 font-black text-sm active:scale-95"
                            >
                              <Icons.Image className="w-5 h-5" />
                              {scene.storyboardImageUrl ? 'Redraw Sketch' : 'Sketch Scene'}
                            </button>

                            {scene.isApproved && scene.storyboardImageUrl && (
                              <button
                                onClick={() => handleGenerateFinalVideo(scene.id)}
                                disabled={!!loading}
                                className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2 font-black text-sm active:scale-95 shadow-lg"
                              >
                                <Icons.Video className="w-5 h-5" />
                                {scene.videoUrl ? 'Re-Animate' : 'Produce Animation'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-7 space-y-6">
                        <div className="aspect-video bg-slate-100 rounded-3xl overflow-hidden border-4 border-slate-900 shadow-2xl relative group">
                          {scene.videoUrl ? (
                            <video 
                              src={scene.videoUrl} 
                              controls 
                              className="w-full h-full object-cover"
                            />
                          ) : scene.storyboardImageUrl ? (
                            <div className="w-full h-full relative">
                              <img 
                                src={scene.storyboardImageUrl} 
                                alt={`Storyboard ${scene.order}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-slate-900/10 mix-blend-multiply pointer-events-none" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center text-slate-300">
                              <Icons.Image className="w-20 h-20 mb-4 opacity-10 animate-pulse" />
                              <span className="text-sm font-bold uppercase tracking-widest">Awaiting Graphite</span>
                            </div>
                          )}
                          
                          <div className="absolute bottom-4 right-4 flex gap-2">
                             {scene.storyboardImageUrl && !scene.videoUrl && (
                              <span className="bg-slate-900/80 backdrop-blur text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                Storyboard {imageSize}
                              </span>
                            )}
                            {scene.videoUrl && (
                              <span className="bg-blue-600/90 backdrop-blur text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg">
                                Final VEO Animation
                              </span>
                            )}
                          </div>
                        </div>

                        {scene.audioUrl && (
                          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-center gap-5 border border-white/10">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Icons.Play className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-2">
                                <h5 className="text-[10px] font-black text-white/50 uppercase tracking-widest">Character Dialogue Audio</h5>
                                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded uppercase">2.5 Flash TTS</span>
                              </div>
                              <audio src={scene.audioUrl} controls className="w-full h-10 mt-1 invert opacity-90" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-8 border-white/10 border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-white/20 rounded-2xl animate-pulse"></div>
            </div>
          </div>
          <h2 className="text-white text-4xl font-bold sketch-font mb-4 tracking-tight">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </h2>
          <p className="text-white/50 max-w-md font-mono text-sm leading-relaxed">{loading}</p>
          <div className="mt-12 flex gap-1">
             {[0,1,2,3].map(i => (
               <div key={i} className={`w-2 h-2 rounded-full bg-white transition-opacity duration-500 ${loadingMsgIdx % 4 === i ? 'opacity-100' : 'opacity-20'}`} />
             ))}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">!</div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest mb-0.5 opacity-50">Studio Error</p>
            <p className="font-bold text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg text-xs font-black uppercase transition">Dismiss</button>
        </div>
      )}

      <ChatBot />
    </div>
  );
};

export default App;
