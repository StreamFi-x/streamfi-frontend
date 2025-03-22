'use client'
import React, { useState } from 'react';
import Image from 'next/image';
import profileImage from '@/public/Images/profile.png';
import Avatar from '@/public/icons/avatar.svg';
import { 
  Instagram, 
  Twitter, 
  Facebook, 
  Youtube, 
  Send, 
  Globe, 
  Edit2, 
  Trash2, 
  Check, 
  X
} from 'lucide-react';
import VerificationPopup from './popup';
import AvatarSelectionModal from './avatar-modal';
import { useToast } from '@/components/ui/toast-provider';

const avatar1 = Avatar;
const avatar2 = Avatar;
const avatar3 = Avatar;
const avatar4 = Avatar;
const avatar5 = Avatar;

interface SocialLink {
  url: string;
  platform: 'instagram' | 'twitter' | 'facebook' | 'youtube' | 'telegram' | 'other';
  isEditing?: boolean;
}

const ProfileSettings: React.FC = () => {
  const { showToast } = useToast();
  const [username, setUsername] = useState('StankHunt_42');
  const [email, setEmail] = useState('Chidinmacasandra@gmail.com');
  const [bio, setBio] = useState('Chidinma Cassandra');
  const [socialLink, setSocialLink] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [editingLink, setEditingLink] = useState<string>('');
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [avatar, setAvatar] = useState(profileImage);
  const [avatarError, setAvatarError] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  const avatarOptions = [avatar1, avatar2, avatar3, avatar4, avatar5];

  const validateAndIdentifyLink = (url: string): SocialLink | null => {
    const urlRegex = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/;
    
    if (!urlRegex.test(url)) {
      return null;
    }
    
    const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)/);
    const domain = domainMatch ? domainMatch[1].toLowerCase() : '';
    if (domain.includes('instagram')) {
      return { url, platform: 'instagram' };
    } else if (domain.includes('twitter') || domain.includes('x.com')) {
      return { url, platform: 'twitter' };
    } else if (domain.includes('facebook') || domain.includes('fb.com')) {
      return { url, platform: 'facebook' };
    } else if (domain.includes('youtube') || domain.includes('youtu.be')) {
      return { url, platform: 'youtube' };
    } else if (domain.includes('telegram') || domain.includes('t.me')) {
      return { url, platform: 'telegram' };
    } else {
      return { url, platform: 'other' };
    }
  };

  const handleAddSocialLink = () => {
    if (socialLink && socialLinks.length < 5) {
      const validatedLink = validateAndIdentifyLink(socialLink);
      
      if (validatedLink) {
        setSocialLinks([...socialLinks, validatedLink]);
        setSocialLink('');
        showToast('Social link added successfully', 'success');
      } else {
        showToast('Please enter a valid URL', 'error');
      }
    } else if (socialLinks.length >= 5) {
      showToast('You can add a maximum of 5 social links', 'info');
    }
  };

  const handleEditLink = (index: number) => {
    const newLinks = [...socialLinks];
    const linkToEdit = newLinks[index];
    setEditingLink(linkToEdit.url);
    newLinks[index] = { ...linkToEdit, isEditing: true };
    setSocialLinks(newLinks);
  };

  const handleUpdateLink = (index: number) => {
    const validatedLink = validateAndIdentifyLink(editingLink);
    
    if (validatedLink) {
      const newLinks = [...socialLinks];
      newLinks[index] = validatedLink;
      setSocialLinks(newLinks);
      setEditingLink('');
      showToast('Link updated successfully', 'success');
    } else {
      showToast('Please enter a valid URL', 'error');
    }
  };

  const handleCancelEdit = (index: number) => {
    const newLinks = [...socialLinks];
    newLinks[index] = { ...newLinks[index], isEditing: false };
    setSocialLinks(newLinks);
    setEditingLink('');
  };

  const handleDeleteLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
    showToast('Link removed', 'info');
  };

  const handleVerifyEmail = () => {
    setShowVerificationPopup(true);
    console.log('Sending verification code to', email);
  };

  const handleVerificationComplete = (code: string) => {
    console.log('Verifying code:', code);
    
    if (code.length === 6) {
      setIsEmailVerified(true);
      setShowVerificationPopup(false);
      showToast('Email verified successfully', 'success');
    }
  };

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
  };

  const handleSaveAvatar = (newAvatar: any) => {
    setAvatar(newAvatar);
    setAvatarError('');
    showToast('Avatar updated successfully', 'success');
  };

  const handleSaveChanges = () => {
    console.log('Saving profile changes...');
    showToast('Profile changes saved successfully', 'success');
  };

  const getInputStyle = (inputName: string) => {
    return `w-full bg-[#2a2a2a] rounded-lg px-4 py-2 text-white text-sm md:text-base 
           outline-none transition-all duration-200 
           ${focusedInput === inputName ? 'border border-[#5A189A]' : ''}`;
  };
  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-500" />;
      case 'twitter':
        return <Twitter className="w-5 h-5 text-blue-400" />;
      case 'facebook':
        return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'youtube':
        return <Youtube className="w-5 h-5 text-red-600" />;
      case 'telegram':
        return <Send className="w-5 h-5 text-blue-500" />;
      default:
        return <Globe className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-[2em]" >
      <div className="mx-auto">
        <div className="bg-[#1a1a1a] rounded-lg px-2 py-3 lg:p-4 md:p-6 mb-6">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative w-24 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-purple-700">
              <Image
                src={avatar}
                alt="Profile Avatar"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <button 
                onClick={handleAvatarClick}
                className="bg-[#2a2a2a] text-white px-3 py-2 rounded text-sm md:text-base hover:bg-[#333] transition"
              >
                Edit Avatar
              </button>
              <p className="text-gray-400 mt-2 text-xs md:text-sm">
                Must be JPEG, PNG, or GIF and cannot exceed 10MB
              </p>
              {avatarError && (
                <p className="text-red-500 mt-1 text-xs md:text-sm">{avatarError}</p>
              )}
            </div>
          </div>
        </div>
    
        <div className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 mb-6">
          <h2 className="text-purple-500 text-lg md:text-xl mb-4 md:mb-6">Basic setting</h2>
          
          <div className="mb-5">
            <label className="block mb-2 text-sm md:text-base">User Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedInput('username')}
              onBlur={() => setFocusedInput(null)}
              className={getInputStyle('username')}
              style={{ outlineWidth: 0, boxShadow: 'none' }}
            />
            <p className="text-gray-500 italic text-xs md:text-sm mt-1">
              You can only change your display name once every 1 months.
            </p>
          </div>
          
          <div className="mb-5">
            <label className="block mb-2 text-sm md:text-base">Email Address</label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                className={`${getInputStyle('email')} `}
                style={{ outlineWidth: 0, boxShadow: 'none' }}
              />
            </div>
            {!isEmailVerified && (
              <p className="text-yellow-500 italic text-xs md:text-sm mt-1">
                Please verify your email address.
              </p>
            )}
          </div>
          
          <div className="mb-5">
            <label className="block mb-2 text-sm md:text-base">Edit Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onFocus={() => setFocusedInput('bio')}
              onBlur={() => setFocusedInput(null)}
              className={`${getInputStyle('bio')} min-h-[7em]`}
              style={{ outlineWidth: 0, boxShadow: 'none', height: '7em'}}
              
            />
            <p className="text-gray-500 italic text-xs md:text-sm mt-1">
              Share a bit about yourself. (Max 150 words)
            </p>
          </div>

        
          <div className="mb-4">
            <h2 className="text-purple-500 text-lg md:text-xl mb-2">Social Links</h2>
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
              <p className="text-gray-500 text-xs md:text-sm">
                Add up to 5 social media links to showcase your online presence.
              </p>
              <div className="flex gap-3 mt-1 md:mt-0">
                <Instagram className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Twitter className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Facebook className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Youtube className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Send className="w-4 h-4 md:w-5 md:h-5 text-gray-400" /> 
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <input
                type="text"
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                onFocus={() => setFocusedInput('socialLink')}
                onBlur={() => setFocusedInput(null)}
                placeholder="paste social media link"
                className={getInputStyle('socialLink')}
                style={{ outlineWidth: 0, boxShadow: 'none' }}
              />
              <button
                onClick={handleAddSocialLink}
                disabled={socialLinks.length >= 5}
                className="bg-[#333] px-5 py-2 rounded-md hover:bg-[#444] transition text-sm md:text-base"
              >
                Add
              </button>
            </div>

            {socialLinks.length > 0 && (
              <div className="mt-[3em] space-y-2">
                {socialLinks.map((link, index) => (
                  <div key={index} className="flex items-center bg-[#2a2a2a] p-2 rounded text-sm md:text-base">
                    {link.isEditing ? (
                      <>
                        <div className="flex-grow mr-2">
                          <input
                            type="text"
                            value={editingLink}
                            onChange={(e) => setEditingLink(e.target.value)}
                            className="w-full bg-[#333] rounded px-3 py-1 text-white text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center">
                          <button 
                            onClick={() => handleUpdateLink(index)}
                            className="p-1 text-green-500 hover:text-green-400"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            onClick={() => handleCancelEdit(index)}
                            className="p-1 text-red-500 hover:text-red-400 ml-1"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center flex-grow">
                          {getSocialIcon(link.platform)}
                          <span className="truncate text-xs md:text-sm ml-2">{link.url}</span>
                        </div>
                        <div className="flex items-center">
                          <button 
                            onClick={() => handleEditLink(index)}
                            className="p-1 text-gray-400 hover:text-white"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteLink(index)}
                            className="p-1 text-gray-400 hover:text-red-500 ml-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end ">
          <button
            onClick={() => { handleSaveChanges(); handleVerifyEmail(); }}
            className="bg-purple-700 hover:bg-purple-800 text-white px-5 py-2 md:px-6 md:py-3 rounded-md transition text-sm md:text-base"
          >
            Save Changes
          </button>
        </div>
      </div>
      {showAvatarModal && (
        <AvatarSelectionModal
          currentAvatar={avatar}
          onClose={() => setShowAvatarModal(false)}
          onSaveAvatar={handleSaveAvatar}
          avatarOptions={avatarOptions}
        />
      )}
      {showVerificationPopup && (
        <VerificationPopup 
          email={email} 
          onClose={() => setShowVerificationPopup(false)}
          onVerify={handleVerificationComplete}
        />
      )}
    </div>
  );
};

export default ProfileSettings;