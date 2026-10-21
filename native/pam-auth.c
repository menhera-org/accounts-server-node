/*
  Copyright (C) 2026 Menhera.org

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  @license
*/

/*
 * pam-auth: minimal PAM authentication helper for accounts-server-node.
 *
 * Usage:  pam-auth <pam-service> <username>
 *
 * The password is read from standard input. One trailing newline ("\n" or
 * "\r\n"), if present, is ignored so that the helper can be tested by hand.
 *
 * Exit status:
 *   0  pam_authenticate() and pam_acct_mgmt() both succeeded
 *   1  PAM rejected the user (bad password, locked/expired account, ...)
 *   2  usage, input or PAM setup error
 *
 * This program deliberately has no dependency on Node.js: the server's
 * privileged parent process spawns it as a child process, so upgrading
 * Node.js can never break the PAM layer (no N-API/ABI, no node-gyp).
 */

#define _GNU_SOURCE

#include <errno.h>
#include <security/pam_appl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* Upper bound for the password read from stdin, in bytes. */
#define PASSWORD_MAX_LEN 65536

struct conv_data {
  const char *password;
};

static void free_replies(struct pam_response *replies, int num_msg) {
  int i;
  for (i = 0; i < num_msg; i++) {
    if (replies[i].resp != NULL) {
      explicit_bzero(replies[i].resp, strlen(replies[i].resp));
      free(replies[i].resp);
    }
  }
  free(replies);
}

/*
 * PAM conversation function. Like the previous node-linux-pam binding, every
 * prompt is answered with the password; informational messages get no reply.
 * The responses are freed by the PAM module that asked for them.
 */
static int conversation(int num_msg, const struct pam_message **msg,
                        struct pam_response **resp, void *appdata_ptr) {
  const struct conv_data *data = appdata_ptr;
  struct pam_response *replies;
  int i;

  if (num_msg <= 0 || num_msg > PAM_MAX_NUM_MSG || msg == NULL ||
      resp == NULL || data == NULL || data->password == NULL) {
    return PAM_CONV_ERR;
  }

  replies = calloc((size_t)num_msg, sizeof(*replies));
  if (replies == NULL) {
    return PAM_BUF_ERR;
  }

  for (i = 0; i < num_msg; i++) {
    switch (msg[i]->msg_style) {
      case PAM_PROMPT_ECHO_OFF:
      case PAM_PROMPT_ECHO_ON:
        replies[i].resp = strdup(data->password);
        if (replies[i].resp == NULL) {
          free_replies(replies, num_msg);
          return PAM_BUF_ERR;
        }
        replies[i].resp_retcode = 0;
        break;
      case PAM_ERROR_MSG:
      case PAM_TEXT_INFO:
        replies[i].resp = NULL;
        replies[i].resp_retcode = 0;
        break;
      default:
        free_replies(replies, num_msg);
        return PAM_CONV_ERR;
    }
  }

  *resp = replies;
  return PAM_SUCCESS;
}

/*
 * Reads the whole of stdin into a NUL-terminated buffer (at most
 * PASSWORD_MAX_LEN bytes), dropping one trailing newline.
 * Returns NULL and sets *error on failure.
 */
static char *read_password(size_t *length, const char **error) {
  const size_t capacity = PASSWORD_MAX_LEN + 1;
  char *buffer = malloc(capacity);
  size_t len = 0;

  if (buffer == NULL) {
    *error = "out of memory";
    return NULL;
  }

  for (;;) {
    ssize_t n = read(STDIN_FILENO, buffer + len, capacity - len);
    if (n < 0) {
      if (errno == EINTR) {
        continue;
      }
      *error = "failed to read the password from stdin";
      goto fail;
    }
    if (n == 0) {
      break;
    }
    len += (size_t)n;
    if (len >= capacity) {
      *error = "password is too long";
      goto fail;
    }
  }

  if (len > 0 && buffer[len - 1] == '\n') {
    len--;
    if (len > 0 && buffer[len - 1] == '\r') {
      len--;
    }
  }
  if (memchr(buffer, '\0', len) != NULL) {
    *error = "password contains a NUL byte";
    goto fail;
  }

  buffer[len] = '\0';
  *length = len;
  return buffer;

fail:
  explicit_bzero(buffer, capacity);
  free(buffer);
  return NULL;
}

int main(int argc, char **argv) {
  const char *service;
  const char *username;
  const char *error = NULL;
  char *password;
  size_t password_length = 0;
  struct conv_data data;
  struct pam_conv conv;
  pam_handle_t *pamh = NULL;
  int ret;
  int status;

  if (argc != 3 || argv[1][0] == '\0' || argv[2][0] == '\0') {
    fprintf(stderr, "usage: pam-auth <pam-service> <username>  (password on stdin)\n");
    return 2;
  }
  service = argv[1];
  username = argv[2];

  password = read_password(&password_length, &error);
  if (password == NULL) {
    fprintf(stderr, "pam-auth: %s\n", error);
    return 2;
  }

  data.password = password;
  conv.conv = conversation;
  conv.appdata_ptr = &data;

  ret = pam_start(service, username, &conv, &pamh);
  if (ret != PAM_SUCCESS) {
    fprintf(stderr, "pam-auth: pam_start: %s\n", pam_strerror(pamh, ret));
    explicit_bzero(password, password_length);
    free(password);
    return 2;
  }

  ret = pam_authenticate(pamh, 0);
  if (ret == PAM_SUCCESS) {
    ret = pam_acct_mgmt(pamh, 0);
  }

  if (ret == PAM_SUCCESS) {
    status = 0;
  } else {
    fprintf(stderr, "pam-auth: %s\n", pam_strerror(pamh, ret));
    status = 1;
  }

  ret = pam_end(pamh, ret);
  if (ret != PAM_SUCCESS) {
    fprintf(stderr, "pam-auth: pam_end: %s\n", pam_strerror(NULL, ret));
    if (status == 0) {
      status = 2;
    }
  }

  explicit_bzero(password, password_length);
  free(password);
  return status;
}
