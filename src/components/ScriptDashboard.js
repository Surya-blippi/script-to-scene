'use client'

import React, { useState } from 'react';
import { 
  Play,
  Settings,
  Image as ImageIcon,
  Upload,
  Download,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  X,
  Eye
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import JSZip from 'jszip';

const ScriptDashboard = () => {
  // State Management
  const [activeStep, setActiveStep] = useState('script');
  const [script, setScript] = useState('');
  const [generatedScenes, setGeneratedScenes] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('cinematic');
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedQuality, setSelectedQuality] = useState('high');
  const [regeneratingScenes, setRegeneratingScenes] = useState(new Set());
  const [animatingScenes, setAnimatingScenes] = useState(new Set());
  


// Function to process image URL to base64 if needed
const processImageUrl = async (imageUrl) => {
  try {
    // If already base64, return as is
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // Fetch and convert to base64
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
};

// Function to validate image before processing
const validateImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const contentType = response.headers.get('content-type');
    
    if (!contentType.startsWith('image/')) {
      throw new Error('Invalid image format');
    }
    
    return true;
  } catch (error) {
    console.error('Image validation failed:', error);
    return false;
  }
};

// Function to clean up object URLs
const cleanupObjectUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

// Function to generate scenes from script
const generateScenes = async () => {
  if (!script.trim()) {
    toast.error("Please enter a script first.");
    return;
  }

  setIsGenerating(true);
  const lines = script.split('\n').filter(line => line.trim());
  const scenes = [];
  
  const loadingToast = toast.loading(`Generating ${lines.length} scenes...`);

  try {
    for (const [index, line] of lines.entries()) {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: line,
          style: selectedStyle,
          aspectRatio: selectedRatio,
          quality: selectedQuality
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate scene ${index + 1}`);
      }

      const data = await response.json();
      
      if (data.imageUrl) {
        scenes.push({
          id: index + 1,
          text: line,
          imageUrl: data.imageUrl,
          status: 'completed',
          timestamp: new Date().toISOString()
        });
      }
    }

    setGeneratedScenes(scenes);
    toast.dismiss(loadingToast);
    toast.success("All scenes generated successfully!", { duration: 3000 });
    setActiveStep('review');
  } catch (error) {
    console.error('Error generating scenes:', error);
    toast.error(error.message, { duration: 3000 });
  } finally {
    setIsGenerating(false);
  }
};

// Function to regenerate a specific scene
const regenerateScene = async (scene) => {
  if (regeneratingScenes.has(scene.id)) {
    return;
  }

  try {
    setRegeneratingScenes(prev => new Set(prev).add(scene.id));
    const loadingToast = toast.loading(`Regenerating scene ${scene.id}`);
    
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: scene.text,
        style: selectedStyle,
        aspectRatio: selectedRatio,
        quality: selectedQuality
      }),
    });

    const data = await response.json();
    
    if (data.imageUrl) {
      // Remove any existing video URL when regenerating
      const updatedScenes = generatedScenes.map(s => 
        s.id === scene.id ? { 
          ...s, 
          imageUrl: data.imageUrl, 
          videoUrl: null, 
          timestamp: new Date().toISOString() 
        } : s
      );
      setGeneratedScenes(updatedScenes);
      toast.success(`Scene ${scene.id} regenerated!`, { duration: 2000 });
    }
  } catch (error) {
    console.error('Error regenerating scene:', error);
    toast.error(`Failed to regenerate scene: ${error.message}`, { duration: 3000 });
  } finally {
    toast.dismiss();
    setRegeneratingScenes(prev => {
      const next = new Set(prev);
      next.delete(scene.id);
      return next;
    });
  }
};

// Function to animate a scene
const animateScene = async (scene) => {
  if (animatingScenes.has(scene.id)) return;

  try {
    // First validate the image
    const isValid = await validateImage(scene.imageUrl);
    if (!isValid) {
      throw new Error('Invalid image for animation');
    }

    // Process the image to base64
    const processedImageUrl = await processImageUrl(scene.imageUrl);

    setAnimatingScenes(prev => new Set(prev).add(scene.id));
    const loadingToast = toast.loading(`Animating scene ${scene.id}`);

    const response = await fetch('/api/animate-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: scene.text,
        first_frame_image: processedImageUrl,
        prompt_optimizer: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Animation request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.videoUrl) {
      const updatedScenes = generatedScenes.map(s => 
        s.id === scene.id ? {
          ...s,
          videoUrl: data.videoUrl,
          lastAnimated: new Date().toISOString()
        } : s
      );
      setGeneratedScenes(updatedScenes);
      toast.success(`Scene ${scene.id} animated!`, { duration: 2000 });
    } else {
      throw new Error('No video URL returned from animation service');
    }
  } catch (error) {
    console.error('Error animating scene:', error);
    toast.error(`Animation failed: ${error.message}`, { duration: 3000 });
  } finally {
    toast.dismiss();
    setAnimatingScenes(prev => {
      const next = new Set(prev);
      next.delete(scene.id);
      return next;
    });
  }
};

// Function to download a single scene
const downloadScene = async (scene) => {
  const loadingToast = toast.loading('Preparing download...');
  
  try {
    const response = await fetch(scene.videoUrl || scene.imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = scene.videoUrl ? 
      `scene-${scene.id}.mp4` : 
      `scene-${scene.id}.webp`;
      
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Scene ${scene.id} downloaded successfully`);
  } catch (error) {
    console.error('Error downloading scene:', error);
    toast.error('Failed to download scene');
  } finally {
    toast.dismiss(loadingToast);
  }
};


// Function to export all scenes
const exportAllScenes = async () => {
  const loadingToast = toast.loading('Preparing export...');
  
  try {
    const zip = new JSZip();
    
    // Add metadata file
    const metadata = {
      exportDate: new Date().toISOString(),
      totalScenes: generatedScenes.length,
      scenes: generatedScenes.map(scene => ({
        id: scene.id,
        text: scene.text,
        hasVideo: !!scene.videoUrl,
        timestamp: scene.timestamp
      }))
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add scenes
    for (const scene of generatedScenes) {
      try {
        const response = await fetch(scene.videoUrl || scene.imageUrl);
        const blob = await response.blob();
        const filename = `scene-${scene.id}${scene.videoUrl ? '.mp4' : '.webp'}`;
        zip.file(filename, blob);
      } catch (error) {
        console.error(`Error adding scene ${scene.id} to zip:`, error);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'scenes.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    toast.success('All scenes exported successfully');
  } catch (error) {
    console.error('Error exporting scenes:', error);
    toast.error('Failed to export scenes');
  } finally {
    toast.dismiss(loadingToast);
  }
};

// Scene Card Component
const SceneCard = ({ scene }) => {
  const [showVideo, setShowVideo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-blue-500 transition-all shadow-sm hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Media Container */}
      <div className="relative aspect-video bg-gray-100">
        {showVideo && scene.videoUrl ? (
          <video 
            src={scene.videoUrl} 
            controls 
            className="w-full h-full object-cover"
            onError={() => {
              toast.error(`Error playing video for scene ${scene.id}`);
              setShowVideo(false);
            }}
          />
        ) : (
          <img 
            src={scene.imageUrl}
            alt={`Scene ${scene.id}`}
            className="w-full h-full object-cover"
            onError={() => {
              toast.error(`Error loading image for scene ${scene.id}`);
            }}
          />
        )}

        {/* Scene Number Badge */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 text-white text-sm rounded-lg">
          Scene {scene.id}
        </div>
        
        {/* Status Indicator */}
        {scene.videoUrl && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-green-500/70 text-white text-xs rounded-lg">
            Animated
          </div>
        )}
        
        {/* Hover Actions Overlay */}
        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-3
          ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
          {/* Play/View Button */}
          {scene.videoUrl ? (
            <button 
              onClick={() => setShowVideo(!showVideo)}
              className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              title={showVideo ? "View Image" : "Play Animation"}
            >
              {showVideo ? <Eye className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          ) : (
            <button 
              onClick={() => animateScene(scene)}
              disabled={animatingScenes.has(scene.id)}
              className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors 
                disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate Animation"
            >
              {animatingScenes.has(scene.id) ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Regenerate Button */}
          <button 
            onClick={() => regenerateScene(scene)}
            disabled={regeneratingScenes.has(scene.id)}
            className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors 
              disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate Scene"
          >
            <RefreshCw 
              className={`w-5 h-5 ${regeneratingScenes.has(scene.id) ? 'animate-spin' : ''}`} 
            />
          </button>

          {/* Download Button */}
          <button 
            onClick={() => downloadScene(scene)}
            className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            title="Download Scene"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Scene Details */}
      <div className="p-4">
        <p className="text-sm text-gray-700 line-clamp-2 min-h-[2.5rem]">
          {scene.text}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{new Date(scene.timestamp).toLocaleTimeString()}</span>
          {scene.lastAnimated && (
            <span>
              Animated: {new Date(scene.lastAnimated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

return (
  <div className="min-h-screen bg-[#FAFAFA]">
    {/* Toast Container */}
    <Toaster 
      position="top-center"
      toastOptions={{
        duration: 2000,
        style: {
          background: '#333',
          color: '#fff',
        },
      }}
    />
    
    {/* Header */}
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between px-6 h-16">
          {/* Logo and Steps */}
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-bold">SceneForge AI</h1>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveStep('script')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                  ${activeStep === 'script' 
                    ? 'bg-black text-white' 
                    : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                1. Script
              </button>
              <button 
                onClick={() => setActiveStep('review')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                  ${activeStep === 'review' 
                    ? 'bg-black text-white' 
                    : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                2. Review & Edit
              </button>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (generatedScenes.length > 0) {
                  setScript('');
                  setGeneratedScenes([]);
                  setActiveStep('script');
                  toast.success('Started new project');
                }
              }}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={exportAllScenes}
              disabled={generatedScenes.length === 0}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-black/90 
                disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed 
                transition-colors"
            >
              Export Project
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Main Content Area */}
    <main className="max-w-[1600px] mx-auto px-6 py-8">
      {activeStep === 'script' && (
        <div className="grid grid-cols-2 gap-8">
          {/* Script Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Script Input</h2>
                  <p className="text-sm text-gray-500">
                    Each line will be converted to a scene
                  </p>
                </div>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Scene 1: A serene forest at dawn..."
                className="w-full h-[400px] resize-none border-0 focus:ring-0 
                  text-gray-700 placeholder-gray-300 text-lg bg-gray-50 
                  rounded-lg p-4"
              />
            </div>
            
            {/* Generate Button */}
            <button
              onClick={generateScenes}
              disabled={isGenerating || !script.trim()}
              className="w-full bg-black text-white p-4 rounded-xl flex items-center 
                justify-center gap-2 hover:bg-black/90 disabled:bg-gray-200 
                disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Scenes...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Generate Scenes
                </>
              )}
            </button>
          </div>

          {/* Generation Parameters */}
          <div className="space-y-6">
            {/* Parameters Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="space-y-1 mb-6">
                <h2 className="text-lg font-semibold">Generation Parameters</h2>
                <p className="text-sm text-gray-500">
                  Customize your scene generation
                </p>
              </div>
              
              <div className="space-y-6">
                {/* Style Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Style</label>
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-lg border-0 text-gray-700"
                  >
                    <option value="cinematic">Cinematic</option>
                    <option value="artistic">Artistic</option>
                    <option value="realistic">Realistic</option>
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Aspect Ratio</label>
                  <select
                    value={selectedRatio}
                    onChange={(e) => setSelectedRatio(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-lg border-0 text-gray-700"
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                  </select>
                </div>

                {/* Quality Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quality</label>
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-lg border-0 text-gray-700"
                  >
                    <option value="high">High Definition</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium mb-4">Tips for better results</h3>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Be specific about scene settings and emotions</li>
                <li>• Include details about lighting and atmosphere</li>
                <li>• Mention character expressions and positions</li>
                <li>• Keep each scene description concise but detailed</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scene Review Section */}
      {activeStep === 'review' && (
        <div className="space-y-8">
          {/* Review Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {generatedScenes.length} scenes generated
              </span>
              <div className="h-4 w-px bg-gray-200"></div>
              <span className="text-sm text-gray-500">
                {generatedScenes.filter(scene => scene.videoUrl).length} scenes animated
              </span>
            </div>

            {/* Review Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveStep('script')}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 
                  rounded-lg transition-colors"
              >
                Back to Script
              </button>
              <button 
                onClick={exportAllScenes}
                className="px-4 py-2 text-sm bg-black text-white rounded-lg 
                  hover:bg-black/90 transition-colors"
              >
                Export All
              </button>
            </div>
          </div>

          {/* Scenes Grid */}
          <div className="grid grid-cols-3 gap-6">
            {generatedScenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>

          {/* Empty State */}
          {generatedScenes.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center 
                justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No scenes generated yet
              </h3>
              <p className="text-gray-500 mb-4">
                Write your script and generate scenes to get started
              </p>
              <button
                onClick={() => setActiveStep('script')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Go to Script Editor
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  </div>
);
};

export default ScriptDashboard;