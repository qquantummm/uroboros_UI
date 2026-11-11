FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Linux binary utilities, Python, GCC multilib, and OPAM
RUN apt-get update && apt-get install -y \
    curl python3 python3-pip build-essential gcc-multilib libc6-dev-i386 \
    binutils file git ocaml opam m4 unzip pkg-config libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Initialize OPAM with OCaml 5.3.0 and all required build packages
RUN opam init --disable-sandboxing -y \
    && opam switch create 5.3.0 \
    && eval $(opam env --switch=5.3.0) \
    && opam install -y ocamlfind ocamlbuild ppx_deriving.6.0.3 parmap.1.2.5 batteries.3.9.0

WORKDIR /app

# Clone the Uroboros engine
RUN git clone https://github.com/s3team/uroboros.git /app/uroboros-engine

WORKDIR /app/uroboros-engine

# Set up the Node.js backend
WORKDIR /app
COPY package*.json ./
RUN npm install express multer cors
COPY server.js ./

EXPOSE 3001

CMD ["sh", "-c", "eval $(opam env --switch=5.3.0) && node server.js"]