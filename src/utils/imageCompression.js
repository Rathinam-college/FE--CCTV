export const compressImage = async (file, maxSizeKB = 50) => {
  return new Promise((resolve, reject) => {
    // If file is already smaller than the max size, return it
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions to aggressively reduce size
        // Start by halving the dimensions if it's very large
        const maxDimension = 800; // Max width/height to help compression
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Attempt to compress
        let quality = 0.7; // Start with 70% quality
        
        const tryCompress = (currentQuality) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Canvas to Blob conversion failed"));
              return;
            }
            if (blob.size <= maxSizeKB * 1024 || currentQuality <= 0.1) {
              try {
                // Create a new File object
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } catch (e) {
                // Fallback to Blob with name and lastModified properties
                blob.name = file.name || 'compressed_image.jpg';
                blob.lastModifiedDate = new Date();
                resolve(blob);
              }
            } else {
              // Recursively reduce quality, clamping to a minimum of 0.05
              tryCompress(Math.max(0.05, currentQuality - 0.15));
            }
          }, 'image/jpeg', currentQuality);
        };

        tryCompress(quality);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
