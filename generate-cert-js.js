const forge = require('node-forge');
const fs = require('fs');

function generateCertificate() {
  // Generate a new key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create a new certificate
  const cert = forge.pki.createCertificate();

  // Set the certificate details
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'US'
  }, {
    shortName: 'ST',
    value: 'Virginia'
  }, {
    name: 'localityName',
    value: 'Blacksburg'
  }, {
    name: 'organizationName',
    value: 'Test'
  }, {
    shortName: 'OU',
    value: 'Test'
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  // Self-sign the certificate
  cert.sign(keys.privateKey);

  // Convert to PEM format
  const pem = {
    private: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(cert)
  };

  // Save to files
  fs.writeFileSync('server.key', pem.private);
  fs.writeFileSync('server.cert', pem.cert);

  console.log('Self-signed certificate generated successfully.');
}

generateCertificate();
