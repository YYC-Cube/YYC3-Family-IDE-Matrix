/**
 * @file: types/lucide-react.d.ts
 * @description: lucide-react 类型声明 — 解决 React 19 类型兼容性问题
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [type],[lucide-react],[declaration]
 *
 * brief: lucide-react 模块类型声明
 *
 * details:
 * - 为 lucide-react 提供类型兼容声明
 * - 解决 React 19 与 lucide-react 类型不兼容问题
 * - 使用通配符导出覆盖所有图标
 *
 * notes: 升级 lucide-react 到兼容版本后可移除此文件
 */

declare module "lucide-react" {
  import type { SVGProps, ForwardRefExoticComponent, RefAttributes } from "react";

  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;

  // 通配符导出：所有图标组件都是 LucideIcon 类型
  export const icons: Record<string, LucideIcon>;

  // 常用具名图标导出（补充类型提示）
  export const Check: LucideIcon;
  export const Copy: LucideIcon;
  export const X: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Settings: LucideIcon;
  export const Sun: LucideIcon;
  export const Moon: LucideIcon;
  export const Search: LucideIcon;
  export const Plus: LucideIcon;
  export const Minus: LucideIcon;
  export const Trash2: LucideIcon;
  export const Edit: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Play: LucideIcon;
  export const Pause: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Info: LucideIcon;
  export const Loader: LucideIcon;
  export const Zap: LucideIcon;
  export const Code: LucideIcon;
  export const File: LucideIcon;
  export const Folder: LucideIcon;
  export const Database: LucideIcon;
  export const Server: LucideIcon;
  export const Globe: LucideIcon;
  export const Shield: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Activity: LucideIcon;
  export const BarChart3: LucideIcon;
  export const LineChart: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Cpu: LucideIcon;
  export const HardDrive: LucideIcon;
  export const Gauge: LucideIcon;
  export const Wifi: LucideIcon;
  export const WifiOff: LucideIcon;
  export const Terminal: LucideIcon;
  export const Layers: LucideIcon;
  export const Boxes: LucideIcon;
  export const Box: LucideIcon;
  export const Package: LucideIcon;
  export const Network: LucideIcon;
  export const Users: LucideIcon;
  export const User: LucideIcon;
  export const Bot: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Lightbulb: LucideIcon;
  export const BookOpen: LucideIcon;
  export const GraduationCap: LucideIcon;
  export const Briefcase: LucideIcon;
  export const Rocket: LucideIcon;
  export const Target: LucideIcon;
  export const Compass: LucideIcon;
  export const Map: LucideIcon;
  export const Clock: LucideIcon;
  export const Calendar: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const MessageCircle: LucideIcon;
  export const Send: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Save: LucideIcon;
  export const Share: LucideIcon;
  export const Filter: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Maximize: LucideIcon;
  export const Minimize: LucideIcon;
  export const Maximize2: LucideIcon;
  export const Minimize2: LucideIcon;
  export const ZoomIn: LucideIcon;
  export const ZoomOut: LucideIcon;
  export const Home: LucideIcon;
  export const Menu: LucideIcon;
  export const PanelLeft: LucideIcon;
  export const PanelRight: LucideIcon;
  export const PanelBottom: LucideIcon;
  export const PanelTop: LucideIcon;
  export const Split: LucideIcon;
  export const Square: LucideIcon;
  export const Circle: LucideIcon;
  export const Hexagon: LucideIcon;
  export const Cog: LucideIcon;
  export const Sliders: LucideIcon;
  export const ToggleLeft: LucideIcon;
  export const ToggleRight: LucideIcon;
  export const Volume2: LucideIcon;
  export const VolumeX: LucideIcon;
  export const Mic: LucideIcon;
  export const MicOff: LucideIcon;
  export const Video: LucideIcon;
  export const VideoOff: LucideIcon;
  export const Phone: LucideIcon;
  export const PhoneOff: LucideIcon;
  export const Headphones: LucideIcon;
  export const Music: LucideIcon;
  export const Image: LucideIcon;
  export const Camera: LucideIcon;
  export const Film: LucideIcon;
  export const Link: LucideIcon;
  export const Unlink: LucideIcon;
  export const Lock: LucideIcon;
  export const Unlock: LucideIcon;
  export const Key: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const Heart: LucideIcon;
  export const Star: LucideIcon;
  export const ThumbsUp: LucideIcon;
  export const ThumbsDown: LucideIcon;
  export const Bookmark: LucideIcon;
  export const Flag: LucideIcon;
  export const Tag: LucideIcon;
  export const Hash: LucideIcon;
  export const AtSign: LucideIcon;
  export const Mail: LucideIcon;
  export const Bell: LucideIcon;
  export const BellOff: LucideIcon;
  export const Gift: LucideIcon;
  export const Award: LucideIcon;
  export const Trophy: LucideIcon;
  export const Crown: LucideIcon;
  export const Flame: LucideIcon;
  export const Droplets: LucideIcon;
  export const Wind: LucideIcon;
  export const Cloud: LucideIcon;
  export const CloudRain: LucideIcon;
  export const CloudSnow: LucideIcon;
  export const CloudSun: LucideIcon;
  export const CloudLightning: LucideIcon;
  export const Umbrella: LucideIcon;
  export const Thermometer: LucideIcon;
  export const Leaf: LucideIcon;
  export const TreeDeciduous: LucideIcon;
  export const TreePine: LucideIcon;
  export const Flower2: LucideIcon;
  export const Wand2: LucideIcon;
  export const Sword: LucideIcon;
  export const ShieldPlus: LucideIcon;
  export const ShieldMinus: LucideIcon;
  export const ShieldX: LucideIcon;
  export const FlowerPot: LucideIcon;
  export const PottedPlant: LucideIcon;
  export const Scissors: LucideIcon;
  export const PenTool: LucideIcon;
  export const MousePointer: LucideIcon;
  export const MousePointer2: LucideIcon;
  export const Pointer: LucideIcon;
  export const Hand: LucideIcon;
  export const Hand2: LucideIcon;
  export const HandMetal: LucideIcon;
  export const HandHeart: LucideIcon;
  export const HandHelping: LucideIcon;
  export const Handshake: LucideIcon;
  export const UsersRound: LucideIcon;
  export const UserRound: LucideIcon;
  export const UserCircle: LucideIcon;
  export const UserSquare: LucideIcon;
  export const UserX: LucideIcon;
  export const UserCheck: LucideIcon;
  export const UserPlus: LucideIcon;
  export const UserMinus: LucideIcon;
  export const UserCog: LucideIcon;
  export const UserLock: LucideIcon;
  export const UserSearch: LucideIcon;
  export const UserVoice: LucideIcon;
  export const UserWand: LucideIcon;
  export const UserX2: LucideIcon;
  export const UserCheck2: LucideIcon;
  export const UserPlus2: LucideIcon;
  export const UserMinus2: LucideIcon;
  export const UserCog2: LucideIcon;
  export const UserLock2: LucideIcon;
  export const UserSearch2: LucideIcon;
  export const UserVoice2: LucideIcon;
  export const UserWand2: LucideIcon;
  export const UserXIcon: LucideIcon;
  export const UserCheckIcon: LucideIcon;
  export const UserPlusIcon: LucideIcon;
  export const UserMinusIcon: LucideIcon;
  export const UserCogIcon: LucideIcon;
  export const UserLockIcon: LucideIcon;
  export const UserSearchIcon: LucideIcon;
  export const UserVoiceIcon: LucideIcon;
  export const UserWandIcon: LucideIcon;
}
