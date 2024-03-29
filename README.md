# TraceFiles Counter
In the production data infrastructure always depends on the requirements of the product customers. The equipment manufacturer cannot predict requirements to the program software for each manufacturer. The manufacturer of [Osai laser maker](https://osai-as.com/en/neomark-easy) machine tools had to make changes to the laser control program to custom requirements of the manufacture. With the changes of program the software has lost products counter that was available for the operator of device. I have developed web application instead of lost functionality has been based on the data infrastructure of manufacture named as 'Tracefiles Counter'.
Web application allows to:
  - calculation of the quantity of the produced product per unit of time
  - record the beginning of the operator's work on this product
  - controlling duplicates to inform the operator to stop production
  - logging of all previously produced products
  - switching to another product and returning to the previous one without losing the counter
  - data transfer from the machine to the data workflow chain

## Environment variables
Application uses environment variables to setting entire workflow. An example of <code>.env</code> file presented below:
```
TRACE_TMP_DIR=/temp/trace_exchange
TRACE_SRC_DIR=/temp/trace_source
APP_PORT=8088
INTERVAL_DELAY_MS=3000
DATETIME_FORMAT=dd.mmm.yy HH:MM:ss
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DATABASE=''
REDIS_AUTH=''
```
## Requirements
Redis server. NodeJS versions: from 12 to 15.

# A real work screenshots
<p align="center">
  <img src="https://github.com/inc0d3w3trust/TraceFilesCounter/blob/main/assets/images/HeaderCounter.png" width="640" title="screenshot1">
</p>
<p align="center">
  <img src="https://github.com/inc0d3w3trust/TraceFilesCounter/blob/main/assets/images/GreenCardCounter.png" width="640" title="screenshot2">
</p>
