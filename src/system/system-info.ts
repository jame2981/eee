// src/system/system-info.ts

/**
 * 系统信息检测模块
 *
 * 提供系统信息检测、兼容性检查等功能
 */

import { execBash, execBashWithResult } from "../shell/shell-executor";

/**
 * 系统信息接口
 */
export interface SystemInfo {
  os: string;
  distro: string;
  version: string;
  arch: string;
  packageManager: string;
  ubuntuCodename?: string; // Ubuntu 发行版代号，如 jammy, focal 等
}

/**
 * 检测操作系统类型
 */
export async function detectOS(): Promise<string> {
  try {
    const uname = await execBash("uname -s");
    return uname.trim().toLowerCase();
  } catch {
    return "unknown";
  }
}

/**
 * 检测 Linux 发行版
 */
export async function detectDistro(): Promise<{ distro: string; version: string; ubuntuCodename?: string }> {
  try {
    const osRelease = await execBash("cat /etc/os-release");
    const lines = osRelease.split('\n');

    let distro = "unknown";
    let version = "unknown";
    let ubuntuCodename: string | undefined = undefined;

    for (const line of lines) {
      if (line.startsWith('ID=')) {
        distro = line.split('=')[1].replace(/"/g, '');
      }
      if (line.startsWith('VERSION_ID=')) {
        version = line.split('=')[1].replace(/"/g, '');
      }
      if (line.startsWith('UBUNTU_CODENAME=')) {
        ubuntuCodename = line.split('=')[1].replace(/"/g, '');
      }
    }

    return { distro, version, ubuntuCodename };
  } catch {
    return { distro: "unknown", version: "unknown" };
  }
}

/**
 * 检测系统架构
 */
export async function detectArch(): Promise<string> {
  try {
    const arch = await execBash("dpkg --print-architecture");
    return arch.trim();
  } catch {
    try {
      const arch = await execBash("uname -m");
      return arch.trim();
    } catch {
      return "unknown";
    }
  }
}

/**
 * 检测包管理器
 */
export async function detectPackageManager(): Promise<string> {
  const managers = [
    { cmd: "apt", name: "apt" },
    { cmd: "yum", name: "yum" },
    { cmd: "dnf", name: "dnf" },
    { cmd: "pacman", name: "pacman" },
    { cmd: "zypper", name: "zypper" },
    { cmd: "emerge", name: "portage" },
    { cmd: "apk", name: "apk" }
  ];

  for (const manager of managers) {
    try {
      const result = await execBashWithResult(`command -v ${manager.cmd}`);
      if (result.success) {
        return manager.name;
      }
    } catch {
      continue;
    }
  }

  return "unknown";
}

/**
 * 获取完整的系统信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const [os, { distro, version, ubuntuCodename }, arch, packageManager] = await Promise.all([
    detectOS(),
    detectDistro(),
    detectArch(),
    detectPackageManager()
  ]);

  return {
    os,
    distro,
    version,
    arch,
    packageManager,
    ubuntuCodename
  };
}

/**
 * 检查系统兼容性
 */
export async function checkSystemCompatibility(requirements: {
  supportedDistros?: string[];
  supportedVersions?: string[];
  supportedArch?: string[];
  requiredPackageManager?: string;
}): Promise<{ compatible: boolean; issues: string[] }> {
  const systemInfo = await getSystemInfo();
  const issues: string[] = [];

  // 检查操作系统
  if (systemInfo.os !== "linux") {
    issues.push(`不支持的操作系统: ${systemInfo.os} (仅支持 Linux)`);
  }

  // 检查发行版
  if (requirements.supportedDistros && !requirements.supportedDistros.includes(systemInfo.distro)) {
    issues.push(`不支持的发行版: ${systemInfo.distro} (支持: ${requirements.supportedDistros.join(", ")})`);
  }

  // 检查版本
  if (requirements.supportedVersions && !requirements.supportedVersions.includes(systemInfo.version)) {
    issues.push(`不支持的版本: ${systemInfo.version} (支持: ${requirements.supportedVersions.join(", ")})`);
  }

  // 检查架构
  if (requirements.supportedArch && !requirements.supportedArch.includes(systemInfo.arch)) {
    issues.push(`不支持的架构: ${systemInfo.arch} (支持: ${requirements.supportedArch.join(", ")})`);
  }

  // 检查包管理器
  if (requirements.requiredPackageManager && systemInfo.packageManager !== requirements.requiredPackageManager) {
    issues.push(`需要包管理器: ${requirements.requiredPackageManager} (当前: ${systemInfo.packageManager})`);
  }

  return {
    compatible: issues.length === 0,
    issues
  };
}

/**
 * 是否为 Ubuntu/Debian 系统
 */
export async function isDebianBased(): Promise<boolean> {
  const { distro } = await detectDistro();
  return ["ubuntu", "debian", "linuxmint", "elementary", "zorin"].includes(distro.toLowerCase());
}

/**
 * 是否为 WSL 环境
 */
export async function isWSL(): Promise<boolean> {
  try {
    const version = await execBash("cat /proc/version");
    return version.toLowerCase().includes("microsoft") || version.toLowerCase().includes("wsl");
  } catch {
    return false;
  }
}

/**
 * 检查网络连接
 */
export async function checkNetworkConnection(url = "https://google.com"): Promise<boolean> {
  try {
    const result = await execBashWithResult(`curl -sSf --connect-timeout 5 ${url}`);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * 验证命令是否可用
 */
export async function verifyCommand(command: string): Promise<boolean> {
  try {
    const result = await execBashWithResult(`command -v ${command}`);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * 获取命令版本
 */
export async function getCommandVersion(command: string, versionFlag = "--version"): Promise<string> {
  try {
    const output = await execBash(`${command} ${versionFlag}`);
    return output.trim();
  } catch (error) {
    throw new Error(`无法获取 ${command} 版本: ${error instanceof Error ? error.message : String(error)}`);
  }
}
