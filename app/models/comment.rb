class Comment < ApplicationRecord
  belongs_to :user, inverse_of: :comments
  belongs_to :comment, inverse_of: :comments, optional: true
  belongs_to :song, inverse_of: :comments

  has_many :comments, inverse_of: :comments
end
