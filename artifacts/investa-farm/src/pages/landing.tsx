import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState, useCallback } from "react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import farmerImg from "@assets/pexels-safari-consoler-3290243-10963690_1778315943106.jpg";
import investorImg from "@assets/IMG_8016_1781250402404.jpeg";
import coopImg from "@assets/pexels-livier-garcia-645743-1459331_1778315943105.jpg";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [tapCount, setTapCount] = useState(0);

  const handleLogoTap = useCallback(() => {
    setTapCount(n => {
      const next = n + 1;
      if (next >= 3) {
        setLocation("/admin");
        return 0;
      }
      setTimeout(() => setTapCount(0), 3000);
      return next;
    });
  }, [setLocation]);

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-white flex flex-col" data-testid="landing-page">
      {/* Logo header */}
      <div className="pt-12 px-6 pb-2 flex items-center justify-center">
        <img src={logoSrc} alt="Investa Farm" className="h-20 w-auto select-none cursor-pointer" onClick={handleLogoTap} />
      </div>

      <div className="px-4 pt-2 pb-4 text-center">
        <p className="text-muted-foreground font-semibold text-sm">Africa's leading financially inclusive platform</p>
      </div>

      {/* Two role cards with photos */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 px-4 space-y-3"
      >
        {/* Farmer card */}
        <button
          data-testid="card-farmer"
          onClick={() => setLocation("/farmer-auth")}
          className="w-full relative rounded-3xl overflow-hidden h-44 flex items-end active:scale-98 transition-all shadow-md group"
        >
          <img src={farmerImg} alt="Farmer" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="relative z-10 p-4 w-full flex items-end justify-between">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 bg-[#16a34a] text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                🌱 For Farmers
              </div>
              <p className="text-white font-bold text-lg leading-tight">I'm a Farmer</p>
              <p className="text-white/80 text-xs">Register group · Apply for funding · Upload KYC</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <ArrowRight size={16} className="text-white" />
            </div>
          </div>
        </button>

        {/* Investor card */}
        <button
          data-testid="card-investor"
          onClick={() => setLocation("/investor-auth")}
          className="w-full relative rounded-3xl overflow-hidden h-44 flex items-end active:scale-98 transition-all shadow-md group"
        >
          <img src={investorImg} alt="Investor" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="relative z-10 p-4 w-full flex items-end justify-between">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                📈 For Investors
              </div>
              <p className="text-white font-bold text-lg leading-tight">I'm an Investor</p>
              <p className="text-white/80 text-xs">Browse farms · Buy shares · Earn returns</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <ArrowRight size={16} className="text-white" />
            </div>
          </div>
        </button>

        {/* Cooperative / Partner card */}
        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          data-testid="card-cooperative"
          onClick={() => setLocation("/cooperative-auth")}
          className="w-full relative rounded-3xl overflow-hidden h-32 flex items-end active:scale-98 transition-all shadow-md group"
        >
          <img src={coopImg} alt="Cooperative" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="relative z-10 p-4 w-full flex items-end justify-between">
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 border border-white/30 bg-white/10">
                🤝 For Partners
              </div>
              <p className="text-white font-bold text-base leading-tight">Cooperative / Distributor</p>
              <p className="text-white/60 text-xs">Join network · Access APIs · Co-finance farmers</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <ArrowRight size={16} className="text-white" />
            </div>
          </div>
        </motion.button>
      </motion.div>

      {/* Footer */}
      <div className="pb-10 px-6 pt-4 text-center">
        <button onClick={() => setLocation("/onboarding")} className="text-primary text-xs font-medium underline underline-offset-2">
          Learn how it works
        </button>
      </div>
    </div>
  );
}
