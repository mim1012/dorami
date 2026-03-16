const crypto = require('crypto');
const addrs = [
  '80003c5a90487429712eefb2523cbda3:943ef1713b0a104c33fdcf7eacaafea4:dc1a3bc6ea29d838fab17b3b318dd6367020e22be17124d4bd84f4c7a3789c9ea60ed546db21d0f5e8963de396e754d4d41840cdacc9534ac88b803d2c804df77bd11e87fcf06a962b7b72ae2a31071667e60228f149fc897d230c33fbef7e5610adb64c991a7a05c00e91c633a2a0ded216e96ee152a8ead3e4b559f6963213667e7c2f476cdcb0d6addc',
  'b92b1c6466f9874180e2776f07ff1d3d:73d6454bd4a4381e2a1b432862028c2b:d662c52641610f22bc892125094c2001a619cf5bc2c64f9fb2f56a585fb392cc5ff6e0b99afa2ea177be688442917b28bc0e4e62eb3b7ddd551eb977f3622dae9965f8b534acaf1a7dcca362bac01c9f4269f5b6665fead4d38d897c2d680bc6aaeec43ca5b79afe94672d2b43e7fe14bd64e613e1b688c74c8673',
  '8dcbd31ee1799f442f3214ec024fd7d2:e60faf803a8d3883518d1ebb5255343a:d0dad93a95a6183b8b63ef279b43134e1fe444f4048cdd4459a8f93330bc6b07343ef4965ee2ce62b33ece928a43c608e7df7a730a6fcd8c5c5903162db8b1ceee489195f6ac7761b430dae700c88d6cab6ad8712881b0fd1cc92f19068c5600d1adf26c0d4d4d57a9d553899a50940fa200c07bed4bf316035aa3a0b585f3b1670656b4ea7fcadd5f1ffe5e6b40183c',
];
const keys = {
  'a9aebb': 'a9aebb443b47d5348843dbe95f43c7a5c805c1e1c238e61844aee8044732c4c0',
  '012345': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'bf105c': 'bf105ce5964b4316b29cd9e3171b503580e9a0a213966811b327ab18e9b632fc',
  '9997fb': '9997fb6b2042aeae369b48af4fbae1003d2dcadcf33c0bd694e19e299060b11f',
  '9d8b09': '9d8b09ed620f78e0e64957672f4106ce840721b94419d253df13ac89e580679c',
};
let found = false;
for (const [name, keyHex] of Object.entries(keys)) {
  const key = Buffer.from(keyHex, 'hex');
  for (const enc of addrs) {
    try {
      const [iv,at,ct] = enc.split(':');
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv,'hex'));
      d.setAuthTag(Buffer.from(at,'hex'));
      let p = d.update(ct,'hex','utf8'); p += d.final('utf8');
      console.log('KEY FOUND:', name, '| Result:', p.substring(0,100));
      found = true;
    } catch(e) {}
  }
}
if (!found) console.log('ALL 5 KEYS FAILED for all addresses');
