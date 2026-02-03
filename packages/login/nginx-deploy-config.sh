# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# OpenCRVS is also distributed under the terms of the Civil Registration
# & Healthcare Disclaimer located at http://opencrvs.org/license.
#
# Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
set -e

escape_sed() {
  printf '%s\n' "$1" | sed 's/[\/&~]/\\&/g'
}

ESC_COUNTRY=$(escape_sed "$COUNTRY_CONFIG_URL_INTERNAL")
ESC_GATEWAY=$(escape_sed "$GATEWAY_URL_INTERNAL")
ESC_CSP=$(escape_sed "$CONTENT_SECURITY_POLICY_WILDCARD")

sed -e "s~{{COUNTRY_CONFIG_URL_INTERNAL}}~$ESC_COUNTRY~g" \
    -e "s~{{GATEWAY_URL_INTERNAL}}~$ESC_GATEWAY~g" \
    -e "s~{{CONTENT_SECURITY_POLICY_WILDCARD}}~$ESC_CSP~g" \
    /etc/nginx/conf.d/default.conf > /tmp/default.conf

cat /tmp/default.conf > /etc/nginx/conf.d/default.conf

# Repeat for index.html
sed -e "s~{{COUNTRY_CONFIG_URL_INTERNAL}}~$ESC_COUNTRY~g" \
    -e "s~{{GATEWAY_URL_INTERNAL}}~$ESC_GATEWAY~g" \
    /usr/share/nginx/html/index.html > /tmp/index.html

cat /tmp/index.html > /usr/share/nginx/html/index.html
