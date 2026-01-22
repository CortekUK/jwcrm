import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageIcon } from "lucide-react";

interface ImageThumbnailProps {
  filePath: string;
  fileName: string;
  onLoad?: () => void;
}

export function ImageThumbnail({ filePath, fileName, onLoad }: ImageThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadImage();
  }, [filePath]);

  const loadImage = async () => {
    setLoading(true);
    setError(false);
    
    try {
      const { data, error: urlError } = await supabase.storage
        .from('wills')
        .createSignedUrl(filePath, 600);

      if (urlError) throw urlError;
      
      if (data?.signedUrl) {
        setImageUrl(data.signedUrl);
        onLoad?.();
      }
    } catch (err) {
      console.error('Failed to load image thumbnail:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#FDFBF4]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-gold-accent))]" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#FDFBF4]">
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-[hsl(var(--jw-gold-accent))]/50 mx-auto mb-2" />
          <p className="text-xs text-[#777777]">Failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={fileName}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
}
