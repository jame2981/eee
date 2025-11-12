// src/package/apt.ts

/**
 * APT 包管理模块
 *
 * 提供 APT 包管理相关功能
 */

import { logger } from "../logger";
import { runAsRootScript } from "../shell/script-executor";

/**
 * APT 统一环境变量配置
 */
const APT_ENV = {
  APT_LISTCHANGES_FRONTEND: "none",
  DEBIAN_FRONTEND: "noninteractive"
};

/**
 * 更新 APT 包索引 (仅限 apt-base 使用)
 * @internal
 */
export async function _aptUpdate(): Promise<void> {
  logger.info("==> 更新包索引...");

  const updateScript = `set -e
export APT_LISTCHANGES_FRONTEND=none

apt-get update -qq`;

  await runAsRootScript(updateScript);
}

/**
 * 公共的APT更新函数
 */
export async function aptUpdate(): Promise<void> {
  await _aptUpdate();
}

/**
 * 安装 APT 包
 */
export async function aptInstall(packages: string | string[]): Promise<void> {
  const pkgList = Array.isArray(packages) ? packages : [packages];
  logger.info(`==> 安装包: ${pkgList.join(", ")}`);

  const installScript = `set -e
export APT_LISTCHANGES_FRONTEND=none
export DEBIAN_FRONTEND=noninteractive

${pkgList.map(pkg => `apt-get install -y ${pkg}`).join('\n')}`;

  await runAsRootScript(installScript);
}

/**
 * 移除 APT 包
 */
export async function aptRemove(packages: string | string[]): Promise<void> {
  const pkgList = Array.isArray(packages) ? packages : [packages];
  logger.info(`==> 移除包: ${pkgList.join(", ")}`);

  const removeScript = `set -e
export APT_LISTCHANGES_FRONTEND=none
export DEBIAN_FRONTEND=noninteractive

apt-get remove -y ${pkgList.join(" ")} || true`;

  await runAsRootScript(removeScript);
}

/**
 * 添加 PPA 源
 */
export async function addPpa(ppa: string): Promise<void> {
  logger.info(`==> 添加 PPA: ${ppa}`);

  // 确保 software-properties-common 已安装
  await aptInstall("software-properties-common");

  const ppaScript = `set -e

# 添加 PPA 源
add-apt-repository -y ${ppa}`;

  await runAsRootScript(ppaScript);
  await aptUpdate();
}

/**
 * 添加 GPG 密钥
 */
export async function addGpgKey(url: string, keyring?: string): Promise<void> {
  const keyringPath = keyring ? `/etc/apt/keyrings/${keyring}.gpg` : `/etc/apt/keyrings/custom.gpg`;

  logger.info(`==> 添加 GPG 密钥: ${url}`);

  const keyScript = `set -e

# 确保目录存在
install -m 0755 -d /etc/apt/keyrings

# 下载并安装密钥（带重试，容器/网络不稳定场景友好）
attempts=3
for i in $(seq 1 $attempts); do
  if curl -fsSL --max-time 60 ${url} | gpg --dearmor -o ${keyringPath}; then
    echo "GPG key downloaded successfully on attempt $i"
    break
  fi
  echo "Attempt $i to download GPG key failed; retrying in 5s..." >&2
  sleep 5
done

if [ ! -s ${keyringPath} ]; then
  echo "Failed to download GPG key from ${url}" >&2
  exit 2
fi

chmod a+r ${keyringPath}`;

  await runAsRootScript(keyScript);
}

/**
 * 添加软件源
 */
export async function addRepository(repo: string, name?: string): Promise<void> {
  logger.info(`==> 添加软件源: ${repo}`);

  const file = name ? `/etc/apt/sources.list.d/${name}.list` : `/etc/apt/sources.list.d/custom.list`;
  const repoScript = `set -e

# 确保 sources.list.d 目录存在
install -m 0755 -d /etc/apt/sources.list.d

# 如果条目已存在则跳过，否则追加
if [ -f "${file}" ] && grep -Fxq "${repo}" "${file}"; then
  echo "Repository already exists in ${file}"
else
  echo "${repo}" | tee -a "${file}" > /dev/null
fi`;

  await runAsRootScript(repoScript);
  await aptUpdate();
}

/**
 * 检查包是否已安装
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    const script = `dpkg -l | grep -q "^ii\\s\\+${packageName}\\s"`;
    await runAsRootScript(script);
    return true;
  } catch {
    return false;
  }
}
