class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :comment, optional: true
  belongs_to :song
end
