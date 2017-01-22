# homebridge-bandwidth-meter
Homebridge Bandwidth Meter (uses SNMP and IFTTT)

The Homebridge Bandwidth Meter is used to monitor the receive and transmit port bandwidths of your Internet or WIFI connections. It works by reading the RX/TX port counters of a home/wifi router which supports the SNMP protocol. The counters are averaged over several SNMP query intervals and the current bandwdith in Mbps is then displayed in an icon in your HomeKit app. In addition, a notification can also be sent using IFTTT to inform you that the bandwidth has exceeded a specified threshold. 
## Bridge configuration
### "bridge_update_interval_in_sec"
This value specifies how often bandwdith updates are pushed to homebridge. This allows real-time updates while viewing the Bandwidth Meter in a HomeKit application. 
## Moving Average Intervals
### "moving_average_intervals"
This value specifies the number of SNMP query intervals used in the calculation of the moving average. A larger number of intervals provides a smoother average. The valid range is from 1 to 10, otherwise the default value of 3 is used.
## SNMP Configuration
### "snmp_ip_address"
The IP address of the router. You can use a CLI utility such as "snmpget" to query your router and determine if it is configured for SNMP. 
### "snmp_community"
The SNMP community as configured on your router. Typical SNMP server defaults are "Private" or "Public". 
### "snmp_oid"
The SNMP OID specifies the counter and port to access. In the example config.json, the OIDs are for 64-bit RX/TX counters for the eth1 port of my router. For example, ".1.3.6.1.2.1.31.1.1.1.10.3" is split into a counter part and a port part where 
ifHCOutOctets = ".1.3.6.1.2.1.31.1.1.1.10", ifHCInOctets = ".1.3.6.1.2.1.31.1.1.1.6" and eth1 = ".3".

64-bit counters are only supported for SNMPv2c or SNMPv3. If your router only supports SNMPv1 or doesn't support 64-bit counters you can use 32-bit counters. Add the port as appropriate.
ifInOctets = ".1.3.6.1.2.1.2.2.1.10"
ifOutOctets = ".1.3.6.1.2.1.2.2.1.16"
### "snmp_query_interval_in_sec"
The interval in seconds at which the SNMP router will be queried for its rx/tx port counters. 
## IFTTT Configuration
### "ifttt_api_key"
Your IFTTT API key. Set the key to empty if you do not which to receive notifications.
### "ifttt_event"
The IFTTT Maker Event corresponding to this notification. The "Notification" box should include {Value1}{Value2}{Value3}{OccurredAt}.
### "ifttt_threshold_mbps"
The bandwidth threshold in Mbps which will trigger a notification.
### "ifttt_maximum_notification_interval_in_sec"
This value specifies how much time should elapse between IFTTT notification. This is to prevent notification flooding if the specified threshold is exceeded for a long period of time.
