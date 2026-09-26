import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useLoginCarX,
  useRegisterCarX,
  useGetProfile,
  useInjectCurrency,
  useUnlockMaps,
  useUnlockClubs,
  useInjectCars,
  useUnlockStreetPass,
  useUnlockProfileStyle,
  useInjectAll,
  useSafeRepair,
  useFixMap,
  useGetCars,
  getGetCarsQueryKey,
} from "@/lib/api-client";
import { CurrencyInputPreset, CarsInjectInputMode } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, DollarSign, Map, Car, Star, Zap, Trophy,
  User, UserPlus, Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle, Users,
  Wrench, ShieldCheck,
} from "lucide-react";
import AccJsonExtractor from "@/components/AccJsonExtractor";

interface CarXSession {
  token: string;
  carxId: string;
  email: string;
  deviceId?: string;
  uniqueId?: string;
}

interface ProfileStats {
  silver: number;
  gold: number;
  xp: number;
  level: number;
  cars: number;
  clubs_count: number;
  real_estates_count: number;
  current_car: string;
  current_car_id?: string;
  streetPass: boolean;
  premium: boolean;
  isVerified: boolean;
  name?: string;
  cars_list?: Array<{ id: string; descId: string; mileage?: number; rating?: number }>;
}

function StatBadge({ label, value, icon, accent, extraBtn, sub }: { label: string; value: string | number; icon: string; accent?: string; extraBtn?: React.ReactNode; sub?: string }) {
  return (
    <div className={`border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md backdrop-blur-md ${accent || "bg-zinc-900/80 border-zinc-800"}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl filter drop-shadow">{icon}</span>
        {extraBtn}
      </div>
      <div className="mt-2.5">
        <div className="text-lg sm:text-xl font-mono font-black text-white truncate tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-[11px] font-chakra font-bold text-zinc-400 uppercase tracking-wider mt-0.5">{label}</div>
        {sub && <div className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  icon,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="space-y-1">
      <label className={`text-xs font-semibold ${accent} flex items-center gap-1`}>
        <span>{icon}</span> {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        placeholder={placeholder}
        className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange, accent }: { label: string; checked: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl border transition-all ${checked ? `${accent} border-opacity-40` : "bg-zinc-800/60 border-zinc-700/60"}`}
    >
      <span className="text-xs font-semibold text-white">{label}</span>
      <div className={`w-9 h-5 rounded-full transition-all relative ${checked ? "bg-emerald-500" : "bg-zinc-600"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </div>
    </button>
  );
}

function BatchField({ label, value, onChange, placeholder, icon, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
        <span>{icon}</span>{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
      />
    </div>
  );
}

function BatchForm({ userToken }: { userToken: string }) {
  const { toast } = useToast();
  const [count, setCount] = useState("5");
  const [password, setPassword] = useState("CARXMING");
  const [silver, setSilver] = useState("50000000");
  const [gold, setGold] = useState("9999");
  const [xp, setXp] = useState("93060");
  const [carsMode, setCarsMode] = useState<"one" | "count" | "none">("one");
  const [carCount, setCarCount] = useState("5");
  const [includeMaps, setIncludeMaps] = useState(true);
  const [includeStreetPass, setIncludeStreetPass] = useState(true);
  const [includeClubs, setIncludeClubs] = useState(true);
  const [includeProfileStyle, setIncludeProfileStyle] = useState(true);
  const [includeVerify, setIncludeVerify] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<{ email: string; password?: string; status: string; message?: string }[]>([]);

  const CAR_MODES = [
    { v: "one", l: "+1 Car", sub: "1 starter car" },
    { v: "count", l: "By Count", sub: "choose amount" },
    { v: "none", l: "No Cars", sub: "resources only" },
  ];

  const handleBatch = async () => {
    const n = Math.min(Math.max(Number(count) || 1, 1), 30);
    setRunning(true);
    setResults([]);
    setLogs(["⚙️ Sending Bulk Account Creation request..."]);
    setProgress(0);

    try {
      const carCountVal = carsMode === "none" ? 0 : carsMode === "one" ? 1 : Math.max(1, Number(carCount) || 5);
      const body = {
        count: n,
        password: password || "CARXMING",
        cash: Number(silver) || 50000000,
        gold: Number(gold) || 9999,
        exp: Math.min(93060, Math.max(1, Number(xp) || 93060)),
        cars_count: carCountVal,
        cars_mode: carsMode,
        unlock_all: includeMaps,
        unlock_clubs: includeClubs,
        unlock_profile_style: includeProfileStyle,
        inject_bp: includeStreetPass,
        verify: includeVerify,
      };

      const res = await fetch("/api/carx/bulk-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.jobId) {
        toast({ title: "Bulk Failed", description: data.message || "Failed to start bulk generation", variant: "destructive" });
        setLogs((l) => [...l, `❌ Error: ${data.message || "Request failed"}`]);
        setRunning(false);
        return;
      }

      const jobId = data.jobId;
      setLogs((l) => [...l, `✅ Bulk Job Started! ID: ${jobId}`]);

      // Poll status every 1 second
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/carx/bulk-status/${jobId}`, {
            headers: { Authorization: `Bearer ${userToken}` },
          });
          const statusData = await statusRes.json();
          if (statusData.success && statusData.job) {
            const job = statusData.job;
            setProgress(job.progress || 0);
            if (job.logs) setLogs(job.logs);
            if (job.results) setResults(job.results);

            if (job.status === "completed" || job.status === "cancelled") {
              clearInterval(interval);
              setRunning(false);
              const okCount = (job.results || []).filter((r: any) => r.status === "success").length;
              toast({ title: "Bulk Complete!", description: `${okCount}/${n} accounts created successfully` });
            }
          }
        } catch {
          // ignore poll error
        }
      }, 1000);
    } catch (err: any) {
      toast({ title: "Bulk Failed", description: err.message || "Network error", variant: "destructive" });
      setRunning(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
      {/* Row 1: count + password */}
      <div className="grid grid-cols-2 gap-3">
        <BatchField label="Accounts (max 30)" value={count} onChange={setCount} placeholder="5" icon="👥" type="number" />
        <BatchField label="Password" value={password} onChange={setPassword} placeholder="CARXMING" icon="🔑" />
      </div>

      {/* Row 2: Currency */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">💰 Currency</p>
        <div className="grid grid-cols-3 gap-2">
          <BatchField label="Silver" value={silver} onChange={setSilver} placeholder="50000000" icon="🪙" type="number" />
          <BatchField label="Gold" value={gold} onChange={setGold} placeholder="9999" icon="💎" type="number" />
          <BatchField label="XP" value={xp} onChange={setXp} placeholder="93060" icon="⚡" type="number" />
        </div>
      </div>

      {/* Row 3: Cars mode */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">🚗 Cars</p>
        <div className="grid grid-cols-3 gap-2">
          {CAR_MODES.map(({ v, l, sub }) => (
            <button
              key={v}
              onClick={() => setCarsMode(v as any)}
              className={`flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all border ${
                carsMode === v ? "bg-purple-500 border-purple-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              <span className="text-xs font-bold">{l}</span>
              <span className={`text-[9px] mt-0.5 ${carsMode === v ? "text-white/70" : "text-zinc-600"}`}>{sub}</span>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {carsMode === "count" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2 space-y-2">
              <BatchField label="Car Count (1-20)" value={carCount} onChange={setCarCount} placeholder="5" icon="🔢" type="number" />
              <div className="flex gap-2">
                {[1, 3, 5, 10].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCarCount(String(c))}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                      carCount === String(c) ? "bg-purple-500/20 border-purple-500 text-purple-300 font-bold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                    }`}
                  >
                    +{c} Cars
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Row 4: Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Toggle label="🗺️  Unlock All Maps" checked={includeMaps} onChange={setIncludeMaps} accent="bg-cyan-500/10 border-cyan-500" />
        <Toggle label="🏆  Unlock Clubs & Houses" checked={includeClubs} onChange={setIncludeClubs} accent="bg-purple-500/10 border-purple-500" />
        <Toggle label="🎟️  Street Pass + EP Points" checked={includeStreetPass} onChange={setIncludeStreetPass} accent="bg-yellow-500/10 border-yellow-500" />
        <Toggle label="🎨  Profile Style (Avatars/Frames)" checked={includeProfileStyle} onChange={setIncludeProfileStyle} accent="bg-pink-500/10 border-pink-500" />
        <Toggle label="⚡  Verify Accounts" checked={includeVerify} onChange={setIncludeVerify} accent="bg-emerald-500/10 border-emerald-500" />
      </div>

      <button
        onClick={handleBatch}
        disabled={running}
        className="w-full py-3 rounded-xl font-bold text-sm tracking-widest uppercase bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
      >
        {running ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Creating {count} Accounts ({progress}%)...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            Create {count || "?"} Accounts
          </span>
        )}
      </button>

      {/* Live Console Logs */}
      {logs.length > 0 && (
        <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-3 font-mono text-xs max-h-40 overflow-y-auto space-y-1">
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Live Progress Terminal</p>
          {logs.map((log, i) => (
            <div key={i} className="text-zinc-300 text-[11px] leading-relaxed">{log}</div>
          ))}
        </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
            Accounts Created — {results.filter(r => r.status === "success").length}/{results.length} Success
          </p>
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${r.status === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
              {r.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
              <span className="font-mono flex-1 truncate">{r.email}</span>
              {r.password && <span className="font-mono text-zinc-400 text-[10px]">{r.password}</span>}
              {r.message && <span className="text-red-400 text-[10px]">{r.message}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginForm({ userToken, onSuccess }: { userToken: string; onSuccess: (s: CarXSession) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "bulk">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { toast } = useToast();

  const generateRandomEmail = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let rand = "";
    for (let i = 0; i < 8; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    return `carx_${rand}@gmail.com`;
  };

  const login = useLoginCarX({
    mutation: {
      onSuccess: (d) => onSuccess({
        token: d.token || "",
        carxId: d.userId || d.user_id || "",
        email: d.email || email,
        deviceId: d.deviceId || "",
        uniqueId: d.uniqueId || "",
        profileStats: d.profileStats
      }),
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: "Login Failed", description: msg || "Invalid credentials", variant: "destructive" });
      },
    },
  });

  const register = useRegisterCarX({
    mutation: {
      onSuccess: (d) => {
        if (d.success === false || !d.token) {
          toast({ title: "Registration Failed", description: d.message || "Registration failed.", variant: "destructive" });
          return;
        }
        toast({ title: "Account Created!", description: "Blueprint applied to your new account" });
        onSuccess({
          token: d.token || "",
          carxId: d.userId || d.user_id || "",
          email: d.email || email,
          deviceId: d.deviceId || "",
          uniqueId: d.uniqueId || "",
          profileStats: d.profileStats
        });
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: "Registration Failed", description: msg || "Try a different email", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    // Retrieve or generate persistent unique device identifiers
    let storedDeviceIds: { deviceId: string; uniqueId: string } | null = null;
    try {
      const savedIds = localStorage.getItem(`carx_device_ids_${email}`);
      if (savedIds) storedDeviceIds = JSON.parse(savedIds);
    } catch {}

    if (!storedDeviceIds) {
      const randHex = (len: number) => {
        const chars = "0123456789abcdef";
        let str = "";
        for (let i = 0; i < len; i++) {
          str += chars[Math.floor(Math.random() * 16)];
        }
        return str;
      };
      storedDeviceIds = {
        deviceId: randHex(32),
        uniqueId: randHex(64),
      };
      localStorage.setItem(`carx_device_ids_${email}`, JSON.stringify(storedDeviceIds));
    }

    const payload = {
      email,
      password,
      userToken,
      deviceId: storedDeviceIds.deviceId,
      uniqueId: storedDeviceIds.uniqueId,
    };

    if (mode === "login") {
      login.mutate({ data: payload });
    } else {
      register.mutate({ data: payload });
    }
  };

  const isPending = login.isPending || register.isPending;

  if (mode === "bulk") {
    return (
      <div>
        <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-xl mb-4">
          {(["login", "register", "bulk"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === "register") {
                  setEmail(generateRandomEmail());
                  setPassword("CARXMING");
                }
              }}
              className={`flex items-center gap-2 flex-1 justify-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                mode === m ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {m === "login" ? <User className="w-3.5 h-3.5" /> : m === "register" ? <UserPlus className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              {m === "login" ? "Login" : m === "register" ? "Register" : "Bulk"}
            </button>
          ))}
        </div>
        <BatchForm userToken={userToken} />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
      <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-xl mb-6">
        {(["login", "register", "bulk"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              if (m === "register") {
                setEmail(generateRandomEmail());
                setPassword("CARXMING");
              }
            }}
            className={`flex items-center gap-2 flex-1 justify-center py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              mode === m ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "login" ? <User className="w-3.5 h-3.5" /> : m === "register" ? <UserPlus className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            {m === "login" ? "Login" : m === "register" ? "Register" : "Bulk"}
          </button>
        ))}
      </div>

      {mode === "register" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-300"
        >
          ℹ️ New account will have the blueprint profile applied automatically.
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Email</label>
            {mode === "register" && (
              <button
                type="button"
                onClick={() => setEmail(generateRandomEmail())}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                title="Generate new random email"
              >
                <RefreshCw className="w-3 h-3" />
                🎲 Randomize
              </button>
            )}
          </div>
          <input
            data-testid="input-carx-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 transition-all font-mono"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Password</label>
            {mode === "register" && (
              <span className="text-[10px] text-amber-400 font-mono">Auto: CARXMING</span>
            )}
          </div>
          <div className="relative">
            <input
              data-testid="input-carx-password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 transition-all pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          data-testid="button-carx-submit"
          type="submit"
          disabled={isPending || !email || !password}
          className="w-full py-3 rounded-xl font-bold text-sm tracking-widest uppercase bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {mode === "login" ? "Logging in..." : "Creating account..."}
            </span>
          ) : (mode === "login" ? "Login to CarX" : "Create Account")}
        </button>
      </form>
    </div>
  );
}

function InjectionPanel({ session, userToken, onDisconnect }: { session: CarXSession; userToken: string; onDisconnect: () => void }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [currencyPreset, setCurrencyPreset] = useState<string>(CurrencyInputPreset.max);
  const [customSilver, setCustomSilver] = useState("50000000");
  const [customGold, setCustomGold] = useState("9999");
  const [customXp, setCustomXp] = useState("999999");

  const [carsMode, setCarsMode] = useState<string>("one_by_one");
  const [customCarCount, setCustomCarCount] = useState("5");
  const [selectedCarModel, setSelectedCarModel] = useState<string>("toyotasupra2020");

  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [extractorModalOpen, setExtractorModalOpen] = useState(false);

  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [fleetSearch, setFleetSearch] = useState("");

  const getProfile = useGetProfile({
    mutation: {
      onSuccess: (d) => {
        if (d.success && d.stats) {
          setProfile({
            silver: d.stats.cash !== undefined ? d.stats.cash : 0,
            gold: d.stats.gold !== undefined ? d.stats.gold : 0,
            xp: d.stats.exp !== undefined ? d.stats.exp : 0,
            level: d.stats.level || 1,
            cars: d.stats.cars || d.stats.cars_count || 0,
            clubs_count: d.stats.clubs_count || 0,
            real_estates_count: d.stats.real_estates_count || 0,
            current_car: d.stats.current_car || "toyotasupra2020",
            current_car_id: d.stats.current_car_id || "",
            streetPass: !!d.stats.street_pass,
            premium: true,
            isVerified: !!d.stats.isVerified,
            name: d.stats.name,
            cars_list: d.stats.cars_list || [],
          });
        }
        setLoadingProfile(false);
      },
      onError: () => { setLoadingProfile(false); toast({ title: "Error", description: "Failed to fetch profile", variant: "destructive" }); },
    },
  });

  const injectCurrency = useInjectCurrency({
    mutation: {
      onSuccess: (d) => {
        setResults(r => ({ ...r, currency: { ok: true, msg: d.message || "Done" } }));
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, currency: { ok: false, msg: msg || "Failed" } }));
      },
    },
  });

  const unlockMaps = useUnlockMaps({
    mutation: {
      onSuccess: (d) => {
        setResults(r => ({ ...r, maps: { ok: true, msg: d.message || "All game maps unlocked!" } }));
        toast({ title: "Maps Unlocked!", description: d.message || "All released city districts unlocked." });
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, maps: { ok: false, msg: msg || "Failed to unlock maps" } }));
        toast({ title: "Unlock Maps Failed", description: msg || "Failed to unlock maps", variant: "destructive" });
      },
    },
  });

  const unlockClubs = useUnlockClubs({
    mutation: {
      onSuccess: (d) => {
        setResults(r => ({ ...r, clubs: { ok: true, msg: d.message || "Done" } }));
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, clubs: { ok: false, msg: msg || "Failed" } }));
      },
    },
  });

  const injectCars = useInjectCars({
    mutation: {
      onSuccess: (d) => {
        setResults(r => ({ ...r, cars: { ok: true, msg: d.message || "Done" } }));
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, cars: { ok: false, msg: msg || "Failed" } }));
      },
    },
  });

  const unlockStreetPass = useUnlockStreetPass({
    mutation: {
      onSuccess: (d) => {
        setResults(r => ({ ...r, streetPass: { ok: true, msg: d.message || "Done" } }));
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, streetPass: { ok: false, msg: msg || "Failed" } }));
      },
    },
  });

  const unlockProfileStyle = useUnlockProfileStyle({
    mutation: {
      onSuccess: (d: any) => {
        setResults(r => ({ ...r, profileStyle: { ok: true, msg: d.message || "Avatars & Frames Unlocked!" } }));
        fetchProfile();
      },
      onError: (err: any) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, profileStyle: { ok: false, msg: msg || "Failed to unlock avatars" } }));
      },
    },
  });

  const injectAll = useInjectAll({
    mutation: {
      onSuccess: (d) => {
        const r = d as { currency?: boolean; maps?: boolean; cars?: number; streetPass?: boolean; message?: string };
        setResults({
          currency: { ok: !!r.currency, msg: "Currency injected" },
          maps: { ok: !!r.maps, msg: "Maps unlocked" },
          cars: { ok: r.cars !== undefined && r.cars > 0, msg: `${r.cars} cars added` },
          streetPass: { ok: !!r.streetPass, msg: r.streetPass ? "Street Pass activated" : "Skipped" },
        });
        toast({ title: "Inject All Complete!", description: r.message });
        fetchProfile();
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: "Inject All Failed", description: msg, variant: "destructive" });
      },
    },
  });

  const safeRepair = useSafeRepair({
    mutation: {
      onSuccess: (d: any) => {
        setResults(r => ({ ...r, safeRepair: { ok: true, msg: d.message || "Safe Repair Complete!" } }));
        toast({ title: "Safe Repair Complete", description: d.message });
        fetchProfile();
      },
      onError: (err: any) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setResults(r => ({ ...r, safeRepair: { ok: false, msg: msg || "Failed to repair account" } }));
      },
    },
  });

  const fixMap = useFixMap({
    mutation: {
      onSuccess: (d: any) => {
        setResults(r => ({ ...r, fixMap: { ok: true, msg: d.message || "Map Error Fixed!" } }));
        toast({ title: "Map Error Fixed", description: d.message || "Authentic blueprint maps and locations restored." });
        fetchProfile();
      },
      onError: (err: any) => {
        const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message || (err as any)?.response?.data?.error;
        setResults(r => ({ ...r, fixMap: { ok: false, msg: msg || "Failed to fix map" } }));
      },
    },
  });

  const carsQuery = useGetCars(
    { userToken },
    { query: { queryKey: getGetCarsQueryKey({ userToken }), enabled: true } }
  );

  const totalCars = carsQuery.data?.total || 86;

  const fetchProfile = () => {
    setLoadingProfile(true);
    getProfile.mutate({
      data: {
        token: session.token,
        userId: session.carxId,
        deviceId: session.deviceId,
        uniqueId: session.uniqueId,
        userToken
      }
    });
  };

  // Auto-load profile on mount (loads immediately on login/register)
  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  const handleInjectCurrency = () => {
    let cashVal = 50000000;
    let goldVal = 9999;
    let expVal = 93060;

    if (currencyPreset === CurrencyInputPreset.custom) {
      cashVal = Number(customSilver) || 0;
      goldVal = Number(customGold) || 0;
      expVal = Number(customXp) || 0;
    } else if (currencyPreset === CurrencyInputPreset.medium) {
      cashVal = 10000000;
      goldVal = 5000;
      expVal = 93060;
    }

    injectCurrency.mutate({
      data: {
        token: session.token,
        userId: session.carxId,
        deviceId: session.deviceId,
        uniqueId: session.uniqueId,
        service_type: "custom_resource",
        cash: cashVal,
        gold: goldVal,
        exp: expVal,
        userToken
      },
    });
  };

  const handleInjectCars = () => {
    let service = "inject_random_cars";
    let countVal = 1;
    let singleCarModel: string | undefined = undefined;

    if (carsMode === "one_by_one") {
      service = "inject_random_cars";
      countVal = 1;
    } else if (carsMode === "all_sequential") {
      service = "inject_all_cars_sequential";
      countVal = 86;
    } else if (carsMode === "single_select") {
      service = "inject_car";
      singleCarModel = selectedCarModel;
    } else if (carsMode === "by_count" || carsMode === "custom") {
      service = "inject_random_cars";
      countVal = Math.max(1, Number(customCarCount) || 1);
    }

    injectCars.mutate({
      data: {
        token: session.token,
        userId: session.carxId,
        deviceId: session.deviceId,
        uniqueId: session.uniqueId,
        service_type: service,
        random_cars_count: countVal,
        inject_car: singleCarModel,
        userToken
      }
    });
  };

  const handleUnlockMaps = () => {
    unlockMaps.mutate({
      data: {
        token: session.token,
        userId: session.carxId,
        deviceId: session.deviceId,
        uniqueId: session.uniqueId,
        service_type: "unlock_maps",
        userToken
      }
    });
  };

  const handleFixMap = () => {
    fixMap.mutate({
      data: {
        token: session.token,
        userId: session.carxId,
        deviceId: session.deviceId,
        uniqueId: session.uniqueId,
        service_type: "fix_map",
        userToken
      }
    });
  };

  const anyPending =
    injectCurrency.isPending || unlockMaps.isPending || unlockClubs.isPending ||
    injectCars.isPending || unlockStreetPass.isPending || unlockProfileStyle.isPending ||
    injectAll.isPending || safeRepair.isPending || fixMap.isPending;

  const CURRENCY_PRESETS = [
    { v: CurrencyInputPreset.max, l: "Max Safe", sub: "50M Cash / 9,999 Gold / Lv 50" },
    { v: CurrencyInputPreset.medium, l: "Medium", sub: "10M Cash / 5,000 Gold / Lv 30" },
    { v: CurrencyInputPreset.custom, l: "Custom", sub: "Set custom amounts" },
  ];

  const CAR_MODES = [
    { v: "one_by_one", l: "+1 Next Car", sub: "Add 1 by 1 safely" },
    { v: "all_sequential", l: "🏎️ All Cars (1 by 1)", sub: "Inject all 1-by-1" },
    { v: "by_count", l: "🔢 By Count", sub: "Inject exact count" },
    { v: "single_select", l: "🚗 Pick 1 Car", sub: "Choose model" },
  ];

  const filteredFleet = (profile?.cars_list || []).filter(c =>
    !fleetSearch || c.descId.toLowerCase().includes(fleetSearch.toLowerCase()) || c.id.includes(fleetSearch)
  );

  return (
    <div className="space-y-4">
      {/* Fleet Modal */}
      {fleetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="cyber-card rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-purple-500/40 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏎️</span>
                <div>
                  <h3 className="text-sm font-gaming font-bold text-white tracking-wide">
                    GARAGE FLEET INSPECTOR ({profile?.cars || 0} CARS)
                  </h3>
                  <p className="text-[11px] font-chakra text-purple-400">
                    Live database of cars parked in account garages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFleetModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-zinc-800 bg-black/40">
              <input
                type="text"
                value={fleetSearch}
                onChange={(e) => setFleetSearch(e.target.value)}
                placeholder="Search car model or slot ID..."
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-400 font-mono"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-black/80">
              {filteredFleet.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-chakra">
                  No cars matching search filter
                </div>
              ) : (
                filteredFleet.map((c, idx) => (
                  <div
                    key={`${c.id}-${idx}`}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      c.id === profile?.current_car_id || c.descId === profile?.current_car
                        ? "bg-purple-950/40 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🏎️</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white uppercase">{c.descId}</span>
                          {(c.id === profile?.current_car_id || c.descId === profile?.current_car) && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                              ACTIVE RIDE
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">Slot #{c.id}</span>
                      </div>
                    </div>
                    {c.rating !== undefined && c.rating > 0 && (
                      <span className="font-mono text-xs text-amber-400 font-bold">
                        ⭐ {c.rating} PR
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between text-[11px] font-chakra text-zinc-500">
              <span>Showing {filteredFleet.length} of {profile?.cars || 0} cars</span>
              <button
                onClick={() => setFleetModalOpen(false)}
                className="text-purple-400 hover:text-purple-300 font-bold uppercase cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logged in Header & Profile Dashboard */}
      <div className="cyber-card rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-800 space-y-6 bg-zinc-900/70 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">AUTHENTICATED GAME SESSION</div>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-white truncate max-w-md mt-1">
              {session.email}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {session.carxId && (
                <div className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/60">
                  CarX ID: <span className="text-amber-400 font-bold select-all">{session.carxId}</span>
                </div>
              )}
              {profile?.isVerified !== undefined && (
                <span className={`text-xs font-chakra font-bold px-3 py-1 rounded-lg border ${
                  profile.isVerified
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                }`}>
                  {profile.isVerified ? "✓ VERIFIED EMAIL" : "⚠️ UNVERIFIED"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
            <button
              onClick={handleFixMap}
              disabled={anyPending}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-500/50 text-amber-300 font-mono text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
              title="Restores genuine map parts and locations from blueprint to fix Map Error"
            >
              <Wrench className={`h-4 w-4 text-amber-400 ${fixMap.isPending ? "animate-spin" : ""}`} />
              {fixMap.isPending ? "Fixing Map..." : "Fix Map Error"}
            </button>
            <button
              onClick={() => setExtractorModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/35 hover:to-indigo-500/35 border border-purple-500/40 text-purple-300 font-mono text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Zap className="h-4 w-4 text-purple-400" />
              Extractor (19 Parts)
            </button>
            <button
              onClick={fetchProfile}
              disabled={loadingProfile}
              className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-mono text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loadingProfile ? "animate-spin" : ""}`} />
              {loadingProfile ? "Syncing..." : "Sync Stats"}
            </button>
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 hover:border-red-400 text-red-400 font-mono text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>

        {/* Live Profile Stats Grid - Wide and Clear */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          <StatBadge
            label="Cash (Silver)"
            value={profile ? `$${profile.silver.toLocaleString()}` : "Loading..."}
            sub="resources.soft"
            icon="💵"
            accent="border-emerald-500/40 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          />
          <StatBadge
            label="Gold Currency"
            value={profile ? `${profile.gold.toLocaleString()}` : "Loading..."}
            sub="resources.hard"
            icon="🪙"
            accent="border-amber-500/40 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          />
          <StatBadge
            label="Player Level"
            value={profile ? `Lv ${profile.level}` : "Loading..."}
            sub={profile ? `${profile.xp.toLocaleString()} EXP` : undefined}
            icon="⚡"
            accent="border-blue-500/40 bg-blue-950/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
          />
          <StatBadge
            label="Garage Fleet"
            value={profile ? `${profile.cars} Cars` : "Loading..."}
            sub="account1_69cars.json"
            icon="🏎️"
            accent="border-purple-500/40 bg-purple-950/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
            extraBtn={
              profile && profile.cars > 0 ? (
                <button
                  type="button"
                  onClick={() => setFleetModalOpen(true)}
                  className="text-[10px] font-chakra font-bold text-purple-400 hover:text-purple-200 underline cursor-pointer"
                >
                  VIEW FLEET
                </button>
              ) : undefined
            }
          />
          <StatBadge
            label="Clubs Completed"
            value={profile ? `${profile.clubs_count} / 7 Clubs` : "Loading..."}
            sub="All 7 Beaten"
            icon="🏆"
            accent="border-yellow-500/40 bg-yellow-950/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
          />
          <StatBadge
            label="Real Estate"
            value={profile ? `${profile.real_estates_count} Garages` : "Loading..."}
            sub="Valid Slots Only"
            icon="🏠"
            accent="border-cyan-500/40 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          />
        </div>

        {profile?.current_car && (
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-black/60 border border-purple-500/30 text-xs font-chakra shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏎️</span>
              <span className="text-zinc-400 font-bold uppercase tracking-wider">ACTIVE GARAGE RIDE:</span>
              <strong className="text-purple-300 font-mono text-sm uppercase">{profile.current_car}</strong>
              {profile.current_car_id && (
                <span className="text-zinc-500 font-mono">(Slot #{profile.current_car_id})</span>
              )}
            </div>
            <button
              onClick={() => setFleetModalOpen(true)}
              className="text-xs font-chakra font-bold text-purple-400 hover:text-purple-300 uppercase underline cursor-pointer"
            >
              Browse Garage Fleet ({profile?.cars || 0} Cars) →
            </button>
          </div>
        )}
      </div>

      {/* Main Injection Workspace - Wide 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMN 1: PURE INJECTIONS (Cars & Resources) */}
        <div className="space-y-6">
          {/* Cars Injection Card - 100% PURE CARS */}
          <div className="bg-zinc-900/60 border border-purple-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Car className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Garage Fleet Injection</h3>
              </div>
              <span className="text-[10px] font-chakra px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold uppercase">
                86 TUNED BUILDS
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Injects authentic tuned builds directly from <span className="text-purple-300 font-mono">account1_69cars.json</span>.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CAR_MODES.map(({ v, l, sub }) => (
                <button
                  key={v}
                  onClick={() => setCarsMode(v)}
                  className={`flex flex-col items-center py-2.5 px-2 rounded-xl text-center transition-all border ${
                    carsMode === v
                      ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                      : "bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/80"
                  }`}
                >
                  <span className="text-xs font-bold">{l}</span>
                  <span className={`text-[10px] mt-0.5 ${carsMode === v ? "text-purple-200" : "text-zinc-500"}`}>{sub}</span>
                </button>
              ))}
            </div>

            <AnimatePresence>
              {carsMode === "one_by_one" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200">
                    <span className="font-bold text-white block mb-0.5">➕ One-By-One Safe Injection:</span>
                    Adds exactly <strong className="text-purple-300">1 new tuned car</strong> from account1_69cars.json into the next available safe apartment slot. Click repeatedly to build your fleet one car at a time without causing any map errors or slot collisions.
                  </div>
                </motion.div>
              )}

              {carsMode === "all_sequential" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <span>🏎️</span>
                      <span>Inject All Cars (One by One Safe Allocation):</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-300">
                      Loops sequentially through every unowned tuned car from <code className="text-purple-300">account1_69cars.json</code> and places each car one by one into the next available safe apartment slot (<code className="text-purple-300">apartment_95</code>, <code className="text-purple-300">Midtown</code>, <code className="text-purple-300">Industrial</code>, <code className="text-purple-300">Suburb</code>). Safely fills your entire garage with <span className="text-emerald-400 font-bold">zero map errors</span>.
                    </p>
                  </div>
                </motion.div>
              )}

              {carsMode === "single_select" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>🚗 Select Specific Car to Add</span>
                    <span className="text-purple-400 font-mono text-[10px]">1 car into next free slot</span>
                  </label>
                  <select
                    value={selectedCarModel}
                    onChange={(e) => setSelectedCarModel(e.target.value)}
                    className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-all font-mono cursor-pointer"
                  >
                    {(carsQuery.data?.cars || [
                      "toyotasupra2020", "nissan180sx", "bmw_m3_e36", "nissan300zx", "skyliner32",
                      "golfgti", "nissansilvias13", "toyotasuprarz", "chevycamaro70", "dodgechallengerrt",
                      "silvias15", "mazdarx7", "bmwe31", "mitsubishievo6", "toyotamark2_100",
                      "lamborghinievo", "civicek9", "nissanz31", "mitsubishievo9", "toyotagr86"
                    ]).map((m: string) => (
                      <option key={m} value={m}>
                        🏎️ {m}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}

              {(carsMode === "by_count" || carsMode === "custom") && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2.5"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                      <span>🚗 Number of Cars to Inject (1 by 1 into slots)</span>
                      <span className="text-purple-400 font-mono text-[10px]">Sequential safe allocation</span>
                    </label>
                    <div className="flex gap-1.5">
                      {[1, 3, 5, 10, 20].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCustomCarCount(String(c))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                            customCarCount === String(c)
                              ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                          }`}
                        >
                          +{c}
                        </button>
                      ))}
                    </div>
                    <input
                      data-testid="input-custom-car-count"
                      type="number"
                      value={customCarCount}
                      onChange={(e) => setCustomCarCount(e.target.value)}
                      min={1}
                      max={86}
                      placeholder="How many cars?"
                      className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-all font-mono mt-1"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200">
                    <span className="font-bold text-white block mb-0.5">⚡ Safe Sequential Injection:</span>
                    Adds exactly <strong className="text-purple-300">{customCarCount || 1} cars</strong> one by one sequentially from the blueprint database into the next available safe apartment slots.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-zinc-300">
                <strong className="text-purple-300 font-semibold block">Safe Garage & Slot Mapping:</strong>
                Every car is safely parked in valid released city district apartment slots (<code className="text-purple-300">apartment_95</code>, <code className="text-purple-300">Midtown</code>, <code className="text-purple-300">Industrial</code>, <code className="text-purple-300">Suburb</code>). Unreleased mountain/sunset zones remain locked to guarantee <span className="text-emerald-400 font-bold">zero map errors</span>.
              </div>
            </div>

            <button
              data-testid="button-inject-cars"
              onClick={handleInjectCars}
              disabled={anyPending}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-purple-900/30"
            >
              {injectCars.isPending ? (
                <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Injecting Cars into Slots...</span>
              ) : carsMode === "one_by_one"
                ? "+1 Inject Next Car (One by One)"
                : carsMode === "all_sequential"
                ? "🏎️ Inject All Cars (One by One into Slots)"
                : carsMode === "single_select"
                ? `Inject ${selectedCarModel} (Into Next Slot)`
                : `Inject ${customCarCount || 1} Cars (One by One)`}
            </button>
            {results.cars && (
              <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${results.cars.ok ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/40" : "text-red-400 bg-red-950/30 border-red-500/40"}`}>
                {results.cars.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {results.cars.msg}
              </div>
            )}
          </div>

          {/* Currency & EXP Injection Card - 100% BLUEPRINT FORMAT */}
          <div className="bg-zinc-900/60 border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Currency & EXP Boost</h3>
              </div>
              <span className="text-[10px] font-chakra px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                BLUEPRINT FORMAT
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Edits resources directly matching <span className="text-amber-300 font-mono">bot_blueprint_b64.txt</span>.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {CURRENCY_PRESETS.map(({ v, l, sub }) => (
                <button
                  key={v}
                  onClick={() => setCurrencyPreset(v)}
                  className={`flex flex-col items-center py-2.5 px-2 rounded-xl text-center transition-all border ${
                    currencyPreset === v
                      ? "bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold"
                      : "bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/80"
                  }`}
                >
                  <span className="text-xs font-bold">{l}</span>
                  <span className={`text-[10px] mt-0.5 ${currencyPreset === v ? "text-black/80 font-medium" : "text-zinc-500"}`}>{sub}</span>
                </button>
              ))}
            </div>

            <AnimatePresence>
              {currencyPreset === CurrencyInputPreset.custom && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2.5"
                >
                  <NumInput label="Cash / Silver" value={customSilver} onChange={setCustomSilver} min={0} max={2140000000} placeholder="50000000" icon="💵" accent="text-emerald-400" />
                  <NumInput label="Gold Currency" value={customGold} onChange={setCustomGold} min={0} max={2140000000} placeholder="9999" icon="🪙" accent="text-amber-400" />
                  <NumInput label="Player EXP (93,060 = Lv 50)" value={customXp} onChange={setCustomXp} min={0} max={2140000000} placeholder="93060" icon="⚡" accent="text-blue-400" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-zinc-300">
                <strong className="text-amber-300 font-semibold block">Authentic Resource Save Format:</strong>
                Updates <code className="text-amber-300">resources.soft</code>, <code className="text-amber-300">resources.hard</code>, and <code className="text-amber-300">resources.experience</code> directly. Maps, slots, and quests are <span className="text-emerald-400 font-bold">100% untouched</span>.
              </div>
            </div>

            <button
              data-testid="button-inject-currency"
              onClick={handleInjectCurrency}
              disabled={anyPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-amber-900/20"
            >
              {injectCurrency.isPending ? (
                <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Injecting Resources...</span>
              ) : "Inject Resources (Cash, Gold & EXP)"}
            </button>
            {results.currency && (
              <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${results.currency.ok ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/40" : "text-red-400 bg-red-950/30 border-red-500/40"}`}>
                {results.currency.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {results.currency.msg}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: MAP UNLOCK, FIXER & PROFILE UNLOCKS */}
        <div className="space-y-6">
          {/* World Map Unlock Card */}
          <div className="bg-zinc-900/60 border border-cyan-500/40 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Map className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">World Map Unlock</h3>
              </div>
              <span className="text-[10px] font-chakra px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                ALL DISTRICTS
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Unlocks all authentic released city districts (<code className="text-cyan-300">industrial</code>, <code className="text-cyan-300">midtown</code>, <code className="text-cyan-300">suburb</code>, <code className="text-cyan-300">port</code>), tracks, garages, and dealerships directly from the blueprint. Mountain & Sunset zones remain cleanly locked to guarantee <strong className="text-emerald-400">zero map errors</strong>.
            </p>

            <button
              data-testid="button-unlock-maps"
              onClick={handleUnlockMaps}
              disabled={anyPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-cyan-950/30"
            >
              {unlockMaps.isPending ? (
                <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Unlocking All Districts...</span>
              ) : "🗺️ Unlock All Maps & City Districts"}
            </button>
            {results.maps && (
              <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${results.maps.ok ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/40" : "text-red-400 bg-red-950/30 border-red-500/40"}`}>
                {results.maps.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {results.maps.msg}
              </div>
            )}
          </div>

          {/* Map Error Fixer Card */}
          <div className="bg-zinc-900/60 border border-amber-500/40 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Map Error Fixer</h3>
              </div>
              <span className="text-[10px] font-chakra px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                BLUEPRINT RESTORER
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              If your account received a <strong className="text-amber-300">"Map Error"</strong> or crash due to corrupted map parts, this safely restores 100% genuine city districts (<code className="text-amber-300">industrial</code>, <code className="text-amber-300">midtown</code>, <code className="text-amber-300">suburb</code>, <code className="text-amber-300">port</code>) and locations from the authentic blueprint.
            </p>

            <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800 text-[11px] text-zinc-400">
              <span className="text-emerald-400 font-bold">✓ Safe Restoration:</span> Does <strong className="text-white">NOT</strong> wipe your garage cars or reset your level.
            </div>

            <button
              data-testid="button-fix-map"
              onClick={handleFixMap}
              disabled={anyPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500/25 to-yellow-500/25 hover:from-amber-500/40 hover:to-yellow-500/40 border border-amber-500/50 text-amber-300 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-md"
            >
              {fixMap.isPending ? (
                <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Restoring Authentic Blueprint Maps...</span>
              ) : "Fix Map Error (Restore Blueprint Maps)"}
            </button>
            {results.fixMap && (
              <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${results.fixMap.ok ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/40" : "text-red-400 bg-red-950/30 border-red-500/40"}`}>
                {results.fixMap.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {results.fixMap.msg}
              </div>
            )}
          </div>

          {/* Clubs & Houses */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-bold text-white">Clubs & Houses</h3>
              </div>
              <span className="text-[10px] font-chakra px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold uppercase">
                COMPLETION
              </span>
            </div>
            <p className="text-xs text-zinc-400">Unlock & complete all 7 clubs with elite race triggers.</p>
            <button
              data-testid="button-unlock-clubs"
              onClick={() => unlockClubs.mutate({
                data: {
                  token: session.token,
                  userId: session.carxId,
                  deviceId: session.deviceId,
                  uniqueId: session.uniqueId,
                  service_type: "unlock_clubs",
                  userToken
                }
              })}
              disabled={anyPending}
              className="w-full py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
            >
              {unlockClubs.isPending ? (
                <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Completing Clubs...</span>
              ) : "Unlock & Beat All 7 Clubs"}
            </button>
            {results.clubs && (
              <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${results.clubs.ok ? "text-emerald-300 bg-emerald-950/30 border-emerald-500/40" : "text-red-400 bg-red-950/30 border-red-500/40"}`}>
                {results.clubs.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {results.clubs.msg}
              </div>
            )}
          </div>

          {/* Street Pass & Avatars Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Street Pass */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Street Pass</h3>
              </div>
              <p className="text-[11px] text-zinc-500">Premium pass & event rewards</p>
              <button
                data-testid="button-unlock-streetpass"
                onClick={() => unlockStreetPass.mutate({
                  data: {
                    token: session.token,
                    userId: session.carxId,
                    deviceId: session.deviceId,
                    uniqueId: session.uniqueId,
                    service_type: "battlepass",
                    unlock_streetpass: true,
                    userToken
                  }
                })}
                disabled={anyPending}
                className="w-full py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                {unlockStreetPass.isPending ? (
                  <span className="flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...</span>
                ) : "Unlock Street Pass"}
              </button>
              {results.streetPass && (
                <div className={`flex items-center gap-1.5 text-xs ${results.streetPass.ok ? "text-green-400" : "text-red-400"}`}>
                  {results.streetPass.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {results.streetPass.msg}
                </div>
              )}
            </div>

            {/* Avatars & Frames */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-pink-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cosmetics</h3>
              </div>
              <p className="text-[11px] text-zinc-500">16 avatars, custom frames & banners</p>
              <button
                data-testid="button-unlock-avatars"
                onClick={() => unlockProfileStyle.mutate({
                  data: {
                    token: session.token,
                    userId: session.carxId,
                    deviceId: session.deviceId,
                    uniqueId: session.uniqueId,
                    service_type: "unlock_profile_style",
                    avatar: "avatar_16",
                    banner: "banner_16",
                    frame: "frame_16",
                    userToken
                  }
                })}
                disabled={anyPending}
                className="w-full py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-400 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                {unlockProfileStyle.isPending ? (
                  <span className="flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Unlocking...</span>
                ) : "Unlock Avatars"}
              </button>
              {results.profileStyle && (
                <div className={`flex items-center gap-1.5 text-xs ${results.profileStyle.ok ? "text-green-400" : "text-red-400"}`}>
                  {results.profileStyle.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {results.profileStyle.msg}
                </div>
              )}
            </div>
          </div>

          {/* Emergency Safe Reset */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Emergency Safe Reset</h3>
            </div>
            <p className="text-[11px] text-zinc-500">Only needed if your game is completely stuck on 'Checking profile'. Resets garage to 1 starting car and valid slots.</p>
            <button
              data-testid="button-safe-repair"
              onClick={() => {
                if (window.confirm("🩹 WARNING: This will reset your garage to 1 starting car, beat all clubs, and repair all slot tables to 100% valid game database values. Use this if your game is stuck on 'Checking profile'. Proceed?")) {
                  safeRepair.mutate({
                    data: {
                      token: session.token,
                      userId: session.carxId,
                      deviceId: session.deviceId,
                      uniqueId: session.uniqueId,
                      service_type: "safe_repair",
                      userToken
                    }
                  });
                }
              }}
              disabled={anyPending}
              className="w-full py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              {safeRepair.isPending ? (
                <span className="flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resetting...</span>
              ) : "Emergency Reset to Starter Car"}
            </button>
            {results.safeRepair && (
              <div className={`flex items-center gap-1.5 text-xs ${results.safeRepair.ok ? "text-green-400" : "text-red-400"}`}>
                {results.safeRepair.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {results.safeRepair.msg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Mega Action */}
      <button
        data-testid="button-inject-all"
        onClick={() => injectAll.mutate({
          data: {
            token: session.token,
            userId: session.carxId,
            deviceId: session.deviceId,
            uniqueId: session.uniqueId,
            service_type: "inject_all",
            userToken
          }
        })}
        disabled={anyPending}
        className="w-full py-4 rounded-2xl font-black text-base sm:text-lg tracking-widest uppercase bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_40px_rgba(245,158,11,0.25)] hover:shadow-[0_0_60px_rgba(245,158,11,0.4)] cursor-pointer"
      >
        {injectAll.isPending ? (
          <span className="flex items-center justify-center gap-3">
            <Zap className="w-5 h-5 animate-pulse" />
            Injecting Safe Boost...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-3">
            <Zap className="w-5 h-5" />
            Safe Boost (Resources + Safe Car + Clubs)
          </span>
        )}
      </button>

      {extractorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="max-w-4xl w-full my-auto">
            <AccJsonExtractor
              adminToken={userToken}
              onClose={() => setExtractorModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function InjectSite({ adminOverrideToken, hideHeader }: { adminOverrideToken?: string; hideHeader?: boolean } = {}) {
  const { token, clearAuth } = useAuth();
  const [session, setSession] = useState<CarXSession | null>(() => {
    try {
      const saved = localStorage.getItem("connectedCarXSession");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSetSession = (s: CarXSession | null) => {
    setSession(s);
    try {
      if (s) {
        localStorage.setItem("connectedCarXSession", JSON.stringify(s));
      } else {
        localStorage.removeItem("connectedCarXSession");
      }
    } catch {}
  };

  const userToken = adminOverrideToken || token || "";

  return (
    <div className={hideHeader ? "w-full" : "min-h-screen bg-[#050508]"}>
      {!hideHeader && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid2" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#f59e0b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />
          </svg>
        </div>
      )}

      <div className={`relative z-10 max-w-6xl w-full mx-auto ${hideHeader ? "py-2" : "px-4 sm:px-6 lg:px-8 py-8"}`}>
        {!hideHeader && (
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden border border-amber-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.25)] bg-black shrink-0">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">ᴄᴀʀ𝕏 sᴛʀᴇᴇᴛ</span>
                  <span className="text-white"> Injector</span>
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">Myanmar CarX Street Tool</p>
              </div>
            </div>
            <button
              data-testid="button-logout"
              onClick={() => { setSession(null); clearAuth(); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all text-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${session ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-zinc-800 border border-zinc-700 text-zinc-500"}`}>
              <div className={`w-2 h-2 rounded-full ${session ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
              {session ? `Connected: ${session.email}` : "Not connected"}
            </div>
            {session && (
              <button
                onClick={() => handleSetSession(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Switch account
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!session ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-md mx-auto"
              >
                <LoginForm userToken={userToken} onSuccess={handleSetSession} />
              </motion.div>
            ) : (
              <motion.div
                key="injection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <InjectionPanel session={session} userToken={userToken} onDisconnect={() => handleSetSession(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
