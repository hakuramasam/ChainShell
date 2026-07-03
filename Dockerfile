FROM ubuntu:24.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install essentials — no compilers, no network listeners
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    coreutils \
    curl \
    dnsutils \
    git \
    iproute2 \
    jq \
    less \
    man-db \
    net-tools \
    openssh-client \
    procps \
    python3 \
    tree \
    vim-tiny \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Remove setuid/setgid binaries that could be exploited
RUN find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

# Remove dangerous tools
RUN rm -f /usr/bin/wall /usr/bin/write /usr/bin/chsh /usr/bin/chfn /usr/bin/newgrp /usr/bin/gpasswd

# Create a non-root user (no blanket sudo)
RUN useradd -m -s /bin/bash shell

# Tier-aware sudo: only enterprise tier gets sudo access
# The wrapper checks CHAINSH_TIER env var set by the container config
RUN echo '#!/bin/bash\n\
if [ "$CHAINSH_TIER" = "enterprise" ]; then\n\
  exec /usr/bin/sudo "$@"\n\
else\n\
  echo "sudo: not available on your current plan (upgrade to Enterprise)"\n\
  exit 1\n\
fi' > /usr/local/bin/sudo-wrapper && \
  chmod +x /usr/local/bin/sudo-wrapper && \
  mv /usr/bin/sudo /usr/bin/sudo.real 2>/dev/null || true && \
  ln -sf /usr/local/bin/sudo-wrapper /usr/bin/sudo

# Lock the root password
RUN passwd -l root 2>/dev/null || true

# Restrict /proc and /sys info
RUN echo "shell hard nproc 128" >> /etc/security/limits.conf && \
    echo "shell hard nofile 256" >> /etc/security/limits.conf

# Set a nice bash prompt (matches ChainShell theme)
RUN echo 'export PS1="\\[\\033[38;2;125;211;252m\\]chain\\[\\033[0m\\] \\[\\033[33m\\]\\w\\[\\033[0m\\] \\$ "' >> /home/shell/.bashrc && \
    echo 'export TERM=xterm-256color' >> /home/shell/.bashrc && \
    echo 'alias ll="ls -la"' >> /home/shell/.bashrc && \
    echo 'alias cls="clear"' >> /home/shell/.bashrc

# Security: prevent shellshock-style env attacks
RUN echo 'export -n BASH_ENV' >> /home/shell/.bashrc

# Create a workspace directory
RUN mkdir -p /workspace && chown shell:shell /workspace

USER shell
WORKDIR /workspace

# Default: run bash
CMD ["/bin/bash"]
