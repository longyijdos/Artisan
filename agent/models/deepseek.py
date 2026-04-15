"""DeepSeek model wrapper with reasoning_content support."""

from langchain_core.language_models import LanguageModelInput
from langchain_deepseek import ChatDeepSeek


class ChatDeepSeekWithReasoning(ChatDeepSeek):
    """ChatDeepSeek subclass that preserves reasoning_content in API requests.

    Upstream _convert_message_to_dict drops additional_kwargs["reasoning_content"]
    during serialisation.  DeepSeek API requires this field on assistant messages
    in multi-step tool-call turns.  This override re-injects it after super()
    builds the payload.
    """

    def _get_request_payload(
        self,
        input_: LanguageModelInput,
        *,
        stop: list[str] | None = None,
        **kwargs: object,
    ) -> dict[str, object]:
        lc_messages = self._convert_input(input_).to_messages()
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)

        raw_messages = payload.get("messages")
        if not isinstance(raw_messages, list):
            return payload

        for lc_msg, raw_payload_message in zip(lc_messages, raw_messages):
            if not isinstance(raw_payload_message, dict):
                continue
            if raw_payload_message.get("role") == "assistant":
                rc = getattr(lc_msg, "additional_kwargs", {}).get("reasoning_content")
                if rc is not None:
                    raw_payload_message["reasoning_content"] = rc

        return payload
