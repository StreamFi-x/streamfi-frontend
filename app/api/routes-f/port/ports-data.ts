export interface PortEntry {
  port: number;
  protocols: string[];
  service: string;
  description: string;
  references?: string[];
}

export const PORTS: PortEntry[] = [
  { port: 20, protocols: ["TCP"], service: "ftp-data", description: "FTP data transfer" },
  { port: 21, protocols: ["TCP"], service: "ftp", description: "FTP control", references: ["RFC 959"] },
  { port: 22, protocols: ["TCP"], service: "ssh", description: "Secure Shell", references: ["RFC 4251"] },
  { port: 23, protocols: ["TCP"], service: "telnet", description: "Telnet", references: ["RFC 854"] },
  { port: 25, protocols: ["TCP"], service: "smtp", description: "Simple Mail Transfer Protocol", references: ["RFC 5321"] },
  { port: 37, protocols: ["TCP", "UDP"], service: "time", description: "Time Protocol", references: ["RFC 868"] },
  { port: 43, protocols: ["TCP"], service: "whois", description: "WHOIS protocol", references: ["RFC 3912"] },
  { port: 53, protocols: ["TCP", "UDP"], service: "dns", description: "Domain Name System", references: ["RFC 1035"] },
  { port: 67, protocols: ["UDP"], service: "dhcps", description: "DHCP server", references: ["RFC 2131"] },
  { port: 68, protocols: ["UDP"], service: "dhcpc", description: "DHCP client", references: ["RFC 2131"] },
  { port: 69, protocols: ["UDP"], service: "tftp", description: "Trivial File Transfer Protocol", references: ["RFC 1350"] },
  { port: 80, protocols: ["TCP"], service: "http", description: "Hypertext Transfer Protocol", references: ["RFC 9110"] },
  { port: 88, protocols: ["TCP", "UDP"], service: "kerberos", description: "Kerberos authentication", references: ["RFC 4120"] },
  { port: 109, protocols: ["TCP"], service: "pop2", description: "Post Office Protocol v2" },
  { port: 110, protocols: ["TCP"], service: "pop3", description: "Post Office Protocol v3", references: ["RFC 1939"] },
  { port: 111, protocols: ["TCP", "UDP"], service: "rpcbind", description: "ONC RPC Portmapper" },
  { port: 119, protocols: ["TCP"], service: "nntp", description: "Network News Transfer Protocol", references: ["RFC 3977"] },
  { port: 123, protocols: ["UDP"], service: "ntp", description: "Network Time Protocol", references: ["RFC 5905"] },
  { port: 135, protocols: ["TCP", "UDP"], service: "msrpc", description: "Microsoft RPC" },
  { port: 137, protocols: ["TCP", "UDP"], service: "netbios-ns", description: "NetBIOS Name Service" },
  { port: 138, protocols: ["UDP"], service: "netbios-dgm", description: "NetBIOS Datagram Service" },
  { port: 139, protocols: ["TCP"], service: "netbios-ssn", description: "NetBIOS Session Service" },
  { port: 143, protocols: ["TCP"], service: "imap", description: "Internet Message Access Protocol", references: ["RFC 9051"] },
  { port: 161, protocols: ["UDP"], service: "snmp", description: "Simple Network Management Protocol", references: ["RFC 3411"] },
  { port: 162, protocols: ["UDP"], service: "snmptrap", description: "SNMP Trap" },
  { port: 179, protocols: ["TCP"], service: "bgp", description: "Border Gateway Protocol", references: ["RFC 4271"] },
  { port: 194, protocols: ["TCP"], service: "irc", description: "Internet Relay Chat" },
  { port: 389, protocols: ["TCP", "UDP"], service: "ldap", description: "Lightweight Directory Access Protocol", references: ["RFC 4511"] },
  { port: 443, protocols: ["TCP"], service: "https", description: "HTTP over TLS/SSL", references: ["RFC 9110"] },
  { port: 445, protocols: ["TCP"], service: "smb", description: "Server Message Block / Microsoft DS" },
  { port: 465, protocols: ["TCP"], service: "smtps", description: "SMTP over TLS" },
  { port: 500, protocols: ["UDP"], service: "isakmp", description: "Internet Security Association and Key Management Protocol", references: ["RFC 7296"] },
  { port: 514, protocols: ["TCP", "UDP"], service: "syslog", description: "Syslog protocol", references: ["RFC 5424"] },
  { port: 515, protocols: ["TCP"], service: "lpd", description: "Line Printer Daemon protocol" },
  { port: 520, protocols: ["UDP"], service: "rip", description: "Routing Information Protocol", references: ["RFC 2453"] },
  { port: 587, protocols: ["TCP"], service: "submission", description: "SMTP mail submission", references: ["RFC 6409"] },
  { port: 631, protocols: ["TCP", "UDP"], service: "ipp", description: "Internet Printing Protocol" },
  { port: 636, protocols: ["TCP"], service: "ldaps", description: "LDAP over TLS" },
  { port: 993, protocols: ["TCP"], service: "imaps", description: "IMAP over TLS" },
  { port: 995, protocols: ["TCP"], service: "pop3s", description: "POP3 over TLS" },
  { port: 1080, protocols: ["TCP"], service: "socks", description: "SOCKS proxy" },
  { port: 1194, protocols: ["UDP"], service: "openvpn", description: "OpenVPN" },
  { port: 1433, protocols: ["TCP"], service: "mssql", description: "Microsoft SQL Server" },
  { port: 1521, protocols: ["TCP"], service: "oracle", description: "Oracle database" },
  { port: 1723, protocols: ["TCP"], service: "pptp", description: "Point-to-Point Tunneling Protocol" },
  { port: 2049, protocols: ["TCP", "UDP"], service: "nfs", description: "Network File System", references: ["RFC 7530"] },
  { port: 2181, protocols: ["TCP"], service: "zookeeper", description: "Apache ZooKeeper" },
  { port: 2375, protocols: ["TCP"], service: "docker", description: "Docker REST API (unencrypted)" },
  { port: 2376, protocols: ["TCP"], service: "docker-tls", description: "Docker REST API (TLS)" },
  { port: 3000, protocols: ["TCP"], service: "http-alt", description: "Common HTTP alternative / dev servers" },
  { port: 3306, protocols: ["TCP"], service: "mysql", description: "MySQL database" },
  { port: 3389, protocols: ["TCP", "UDP"], service: "rdp", description: "Remote Desktop Protocol" },
  { port: 3690, protocols: ["TCP"], service: "svn", description: "Apache Subversion" },
  { port: 4369, protocols: ["TCP"], service: "epmd", description: "Erlang Port Mapper Daemon" },
  { port: 5000, protocols: ["TCP"], service: "upnp", description: "UPnP / common dev server port" },
  { port: 5432, protocols: ["TCP"], service: "postgresql", description: "PostgreSQL database" },
  { port: 5672, protocols: ["TCP"], service: "amqp", description: "Advanced Message Queuing Protocol" },
  { port: 5900, protocols: ["TCP"], service: "vnc", description: "Virtual Network Computing" },
  { port: 6379, protocols: ["TCP"], service: "redis", description: "Redis key-value store" },
  { port: 6443, protocols: ["TCP"], service: "kubernetes", description: "Kubernetes API server" },
  { port: 6667, protocols: ["TCP"], service: "irc-alt", description: "IRC (alternate)" },
  { port: 8080, protocols: ["TCP"], service: "http-proxy", description: "HTTP alternate / proxy" },
  { port: 8443, protocols: ["TCP"], service: "https-alt", description: "HTTPS alternate" },
  { port: 8883, protocols: ["TCP"], service: "mqtt-tls", description: "MQTT over TLS" },
  { port: 9000, protocols: ["TCP"], service: "cslistener", description: "Common app server port" },
  { port: 9092, protocols: ["TCP"], service: "kafka", description: "Apache Kafka" },
  { port: 9200, protocols: ["TCP"], service: "elasticsearch", description: "Elasticsearch REST API" },
  { port: 9300, protocols: ["TCP"], service: "elasticsearch-cluster", description: "Elasticsearch cluster comms" },
  { port: 10000, protocols: ["TCP", "UDP"], service: "webmin", description: "Webmin admin panel" },
  { port: 27017, protocols: ["TCP"], service: "mongodb", description: "MongoDB" },
  { port: 50000, protocols: ["TCP"], service: "jenkins", description: "Jenkins CI agent" },
  { port: 51820, protocols: ["UDP"], service: "wireguard", description: "WireGuard VPN" },
];

const BY_PORT = new Map<number, PortEntry>(PORTS.map((p) => [p.port, p]));
const BY_SERVICE = new Map<string, PortEntry>(PORTS.map((p) => [p.service.toLowerCase(), p]));

export function lookupByPort(port: number): PortEntry | undefined {
  return BY_PORT.get(port);
}

export function lookupByService(service: string): PortEntry | undefined {
  return BY_SERVICE.get(service.toLowerCase());
}
