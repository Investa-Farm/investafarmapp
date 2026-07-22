import { motion } from "framer-motion";
import { Search, MapPin, Leaf, Filter } from "lucide-react";
import maizeImg from "@assets/generated_images/maize_farm.jpg";
import wheatImg from "@assets/generated_images/wheat_farm.jpg";
import coffeeImg from "@assets/generated_images/coffee_estate.jpg";
import TouchIndicator from "../components/TouchIndicator";

export default function Scene1() {
  const cards = [
    { name: "Kiambu Maize Farm", location: "Kiambu, KE", crop: "Maize", price: "KES 45", roi: "22%", img: maizeImg, color: "#16a34a" },
    { name: "Nakuru Wheat Project", location: "Nakuru, KE", crop: "Wheat", price: "KES 120", roi: "18%", img: wheatImg, color: "#d4a017" },
    { name: "Meru Coffee Estate", location: "Meru, KE", crop: "Coffee", price: "KES 85", roi: "25%", img: coffeeImg, color: "#b91c1c" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0a0e17] flex flex-col font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8 }}
    >
      {/* Header */}
      <motion.div 
        className="px-6 pt-14 pb-4 bg-[#0f1420] border-b border-white/10 z-20 relative"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-['Space_Grotesk'] text-[#16a34a]">Investa Farm</h2>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 bg-[#d4a017] rounded-full" />
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white/5 rounded-xl h-10 flex items-center px-3 border border-white/10">
            <Search size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500 ml-2">Search farms...</span>
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 relative">
            <Filter size={16} className="text-white" />
          </div>
        </div>
      </motion.div>

      {/* Cards List */}
      <motion.div 
        className="flex-1 px-5 pt-6 pb-20 flex flex-col gap-5 relative z-10"
        animate={{ y: [0, -100] }}
        transition={{ delay: 6, duration: 3, ease: "easeInOut" }}
      >
        {cards.map((card, i) => (
          <motion.div
            key={i}
            className="bg-[#0f1420] rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 + i * 0.2, type: "spring", bounce: 0.3 }}
          >
            <div className="h-32 w-full relative overflow-hidden bg-gray-800">
               <img src={card.img} alt={card.name} className="absolute w-full h-full object-cover opacity-80" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#0f1420] via-[#0f1420]/60 to-transparent" />
               <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg flex items-center gap-1 border border-white/10">
                 <Leaf size={12} className="text-[#16a34a]" />
                 <span className="text-xs font-semibold text-white">{card.crop}</span>
               </div>
               <div className="absolute bottom-3 left-3">
                 <h3 className="font-['Space_Grotesk'] font-bold text-lg leading-tight text-white">{card.name}</h3>
                 <div className="flex items-center gap-1 text-gray-300 mt-1">
                   <MapPin size={12} />
                   <span className="text-xs">{card.location}</span>
                 </div>
               </div>
            </div>
            
            <div className="p-4 flex justify-between items-center border-t border-white/5">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Share Price</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-['Space_Grotesk'] text-[#16a34a]">{card.price}</span>
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Proj. ROI</p>
                <span className="text-lg font-bold text-[#d4a017]">{card.roi}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tap on filter */}
      <TouchIndicator x={330} y={120} delay={8.5} />
    </motion.div>
  );
}