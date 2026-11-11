FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js requirements, Python, and the OCaml toolchain (opam)
RUN apt-get update && apt-get install -y \
    curl python3 python3-pip build-essential git ocaml opam \
    && rm -rf /var/lib/apt/lists/*

# Install modern Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Initialize OPAM (OCaml Package Manager) and install Uroboros dependencies
RUN opam init --disable-sandboxing -y \
    && opam install -y ppx_deriving batteries

WORKDIR /app

# Clone the real Uroboros engine
RUN git clone https://github.com/s3team/uroboros.git /app/uroboros-engine

# CRITICAL STEP: Compile the Uroboros OCaml engine
WORKDIR /app/uroboros-engine
RUN eval $(opam env) && make

# Switch back to the root app directory to set up the Node.js backend
WORKDIR /app
COPY package*.json ./
RUN npm install express multer cors
COPY server.js ./

EXPOSE 3001

CMD ["node", "server.js"]