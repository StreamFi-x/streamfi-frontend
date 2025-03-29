import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface AvatarSelectionModalProps {
  currentAvatar: any;
  onClose: () => void;
  onSaveAvatar: (avatar: any) => void;
  avatarOptions: any[]; 
}

const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({
  currentAvatar,
  onClose,
  onSaveAvatar,
  avatarOptions,
}) => {
  const [previewAvatar, setPreviewAvatar] = useState<any>(currentAvatar);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewAvatar(currentAvatar);
    setUploadedFileUrl(null);
  }, [currentAvatar]);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('File must be JPEG, PNG, or GIF');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert('File size cannot exceed 10MB');
      return;
    }
    
    
    const objectURL = URL.createObjectURL(file);
    
    
    setUploadedFileUrl(objectURL);
    setPreviewAvatar(objectURL);
    
    
    event.target.value = '';
  };

  const handleSelectAvatar = (selectedAvatar: any) => {
    
    setPreviewAvatar(selectedAvatar);
    
    setUploadedFileUrl(null);
  };

  const handleSaveChanges = () => {
    if (uploadedFileUrl) {
      onSaveAvatar(uploadedFileUrl);
    } else if (previewAvatar) {
      onSaveAvatar(previewAvatar);
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg p-6 max-w-md w-full mx-4 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Avatar</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-purple-600">
            <Image
              src={previewAvatar}
              alt="Avatar Preview"
              fill
              className="object-cover"
            />
          </div>
        </div>
        
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/gif"
          className="hidden"
        />
        
        <button
          onClick={handleFileUploadClick}
          className="w-full bg-[#2a2a2a] text-white py-3 rounded-md hover:bg-[#333] transition mb-6"
        >
          Upload from device
        </button>
        
        <p className="text-gray-400 text-sm text-center mb-6">
          Upload in JPEG or PNG format with dimensions ranging from 128×128px to 1500×1500px, and maximum size of 10MB.
        </p>
        
        <div className="w-full h-px bg-gray-800 mb-6"></div>
        
        <p className="text-center text-white mb-4">or choose from the avatars below</p>
        
        <div className="grid grid-cols-5 gap-4 mb-6">
          {avatarOptions.map((avatar, index) => (
            <button 
              key={index}
              onClick={() => handleSelectAvatar(avatar)}
              className={`relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 ${
                previewAvatar === avatar ? 'border-purple-500' : 'border-transparent hover:border-purple-500'
              } focus:border-purple-500 transition`}
            >
              <Image src={avatar} alt={`Avatar option ${index + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
        
        <button
          onClick={handleSaveChanges}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 rounded-md transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default AvatarSelectionModal;